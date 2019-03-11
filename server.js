const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true});
var user = new mongoose.Schema({
  username : {
    type: String,
    required: true
  }
});
var workout = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  }
});
var Users = mongoose.model('Users', user);
var Workouts = mongoose.model('Workouts', workout);
app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

var addToDatabase = (data, done)=>{
  data.save((err, data)=>{
    if(err) errorHandler(err);
    done(null, data)
  });
}

app.get('/', (req, res) => {
  console.log(req.method + " " + req.path + " " + req.ip);
  res.sendFile(__dirname + '/views/index.html')
});

app.use("/api/exercise/new-user", bodyParser.urlencoded({extended:false}));
app.use("/api/exercise/add", bodyParser.urlencoded({extended:false}));
app.use("/api/exercise/log", bodyParser.urlencoded({extended:false}));
app.use(express.static('public'))

/*I can get an array of all users by getting
api/exercise/users with the same info as when
creating a user.*/
app.route("/api/exercise/users").get((req, res)=>{
  Users.find().select(["username","_id"]).exec((err, data)=>{
    if(err) return err;
    console.log(data);
    res.json(data.map((d)=>{
      return {
        username:d.username,
        "_id":d._id
      }
    }));
  });
});

/*I can create a user by posting form data username
to /api/exercise/new-user and returned will be an
object with username and _id.*/
app.route("/api/exercise/new-user").post((req, res)=>{
  var doc = new Users({
    username: req.body.username
  });
  addToDatabase(doc, (err, data)=>{
    console.log(data);
    res.json({"username":data.username, "_id":data._id});
  });
});

/*I can add an exercise to any user by posting form
data userId(_id), description, duration, and
optionally date to /api/exercise/add. If no date
supplied it will use current date. Returned will
the the user object with also with the exercise 
fields added.*/
app.route("/api/exercise/add").post((req, res)=>{
  var exercise = new Workouts({
    userId: req.body.userId,
    description: req.body.description,
    duration: +req.body.duration,
    date: (req.body.date=="")?new Date().getTime():new Date(req.body.date).getTime()
  });
  addToDatabase(exercise, (err, data)=>{
    findUserById(req.body.userId, (err, userData)=>{
      res.json({
        user:userData,
        workout: data
      });          
    });
  });
});

var findUserById = (id, done)=>{
  Users.findOne({_id:id}, (err, data)=>{
    if(err) {
      errorHandler(err);
      done(err, "no user found with id " + id.toString());
    }else{
      done(null, {"_id":data._id, username:data.username});
    }
  });
};

var errorHandler = (err)=>{
  console.log(err);
};

//Gets log of workouts from query, filtered if necessary
var getLog = (query, done)=>{
  Workouts.find({userId: query.userId}, (err,data)=>{
    if(err) errorHandler(err);
    let log = Array.from(data);
    if(typeof query.from !== "undefined"){
      log = log.filter((d)=>d.date>=new Date(query.from).getTime());
      console.log(new Date(query.from)=="Invalid Date")
    }
    if(typeof query.to !== "undefined"){
      log = log.filter((d)=>d.date<=new Date(query.to).getTime());
    }
    if(typeof query.limit !== "undefined"){
      log = log.filter((d,i)=>!isNaN(query.limit)&&i<query.limit);
    }
    if(log.length == 0){
      log="No exercises found";
      if(typeof query.from!=="undefined" && new Date(query.from)=="Invalid Date") log+= " because " + query.from + " is not a valid date ";
      if(typeof query.to!=="undefined" && new Date(query.to)=="Invalid Date") log+= " because " + query.to + " is not a valid date ";
      if(typeof query.limit!=="undefined" && isNaN(query.limit)) log += " because " + query.limit + " is not a valid number";
    }
    done(null, log);
  })
}

/* I can retrieve a full exercise log of any user by getting /api/exercise/log with a parameter of userId(_id). Return will be the user
  object with added array log and count (total exercise count).*/
app.route("/api/exercise/log").get((req, res)=>{    
  findUserById(req.query.userId, (err, userData)=>{
    getLog(req.query, (err, workoutData)=>{
      res.json({user: userData, log: workoutData});
    });
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})


app.get("/api/exercise/new-user", (req, res)=>{
  console.log()
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
