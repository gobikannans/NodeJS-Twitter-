const express = require("express");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

let db;

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Database error is ${error.message}`);
    process.exit(1);
  }
};

initializeDBandServer();

//--API 1---REGISTER-API---//

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const checkUser = `select username from user where username='${username}';`;
  const dbUser = await db.get(checkUser);
  console.log(dbUser);

  if (dbUser === undefined) {
    const addUser = `
      INSERT INTO user(name, username, password, gender)
      VALUES
          ('${name}','${username}','${hashedPassword}','${gender}');`;

    if (password.length > 6) {
      await db.run(addUser);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//*----------------------------------------------------------------------*//

//--API 2---LOGIN-API---//

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUser = `
    SELECT * FROM user WHERE username="${username}"`;

  const dbUser = await db.get(checkUser);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "doggy");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//*----------------------------------------------------------------------*//

//--Authenticate token---//

const authenticationToken = (request, response, next) => {
  let jwtToken;

  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }

  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "doggy", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//*----------------------------------------------------------------------*//

//--API 3--//

app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    let { username } = request;
    const getUser = `SELECT user_id FROM user where username='${username}';`;
    const getUserId = await db.get(getUser);
    console.log(getUserId);
    const getFollowing = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getUserId.user_id};`;
    const getFollowingId = await db.all(getFollowing);
    console.log(getFollowingId);

    const getFollowingArray = getFollowingId.map((eachUser) => {
      return eachUser.following_user_id;
    });
    console.log(getFollowingArray);

    const getTweets = `
  SELECT user.username,tweet.tweet,tweet.date_time AS dateTime FROM user INNER JOIN tweet 
  on user.user_id=tweet.user_id
  WHERE user.user_id in (${getFollowingArray})
  ORDER BY tweet.date_time desc limit 4;`;

    const getFeeds = await db.all(getTweets);
    response.send(getFeeds);
  }
);

//*----------------------------------------------------------------------*//

//--API 4--//

app.get("/user/following/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUser = `SELECT user_id FROM user where username='${username}';`;
  const getUserId = await db.get(getUser);
  console.log(getUserId);
  const getFollowing = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getUserId.user_id};`;
  const getFollowingId = await db.all(getFollowing);
  console.log(getFollowingId);
  const getFollowingArray = getFollowingId.map((eachUser) => {
    return eachUser.following_user_id;
  });
  console.log(getFollowingArray);

  const getFollowersResult = `SELECT name FROM user where user_id in (${getFollowingArray});`;

  const getNames = await db.all(getFollowersResult);
  response.send(getNames);
});

//*----------------------------------------------------------------------*//

//--API 5--//

app.get("/user/followers/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUser = `SELECT user_id FROM user where username='${username}';`;
  const getUserId = await db.get(getUser);
  console.log(getUserId);
  const getFollowing = `SELECT follower_user_id FROM follower 
  WHERE following_user_id=${getUserId.user_id};`;
  const getFollowingId = await db.all(getFollowing);
  console.log(getFollowingId);
  const getFollowingArray = getFollowingId.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  console.log(getFollowingArray);

  const getFollowersResult = `SELECT name FROM user where user_id in (${getFollowingArray});`;

  const getNames = await db.all(getFollowersResult);
  response.send(getNames);
});

//*----------------------------------------------------------------------*//

//--API 6--//

const api6Result = (likes_count, replies_count, date_time_query) => {
  return {
    tweet: date_time_query.tweet,
    likes: likes_count.likes,
    replies: replies_count.replies,
    dateTime: date_time_query.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  let { tweetId } = request.params;
  console.log(tweetId);
  let { username } = request;

  const getUser = `SELECT user_id FROM user where username='${username}';`;
  const getUserId = await db.get(getUser);
  //console.log(getUserId);
  const getFollowing = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getUserId.user_id};`;
  const getFollowingId = await db.all(getFollowing);
  //console.log(getFollowingId);
  const getFollowingArray = getFollowingId.map((eachUser) => {
    return eachUser.following_user_id;
  });
  //console.log(getFollowingArray);

  const getTweetQuery = `SELECT tweet_id FROM tweet WHERE user_id in (${getFollowingArray})`;
  const getTweetId = await db.all(getTweetQuery);
  const getTweetIdArray = getTweetId.map((eachTweet) => eachTweet.tweet_id);
  console.log(getTweetIdArray);

  if (getTweetIdArray.includes(parseInt(tweetId))) {
    const likesQuery = `SELECT count(user_id) AS likes FROM like WHERE tweet_id=${tweetId};`;
    const likes_count = await db.get(likesQuery);

    const replyQuery = `SELECT count(user_id) AS replies FROM reply WHERE tweet_id=${tweetId};`;
    const replies_count = await db.get(replyQuery);

    const dateQuery = `SELECT tweet, date_time  FROM tweet WHERE tweet_id=${tweetId};`;
    const date_time_query = await db.get(dateQuery);

    response.send(api6Result(likes_count, replies_count, date_time_query));
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//*----------------------------------------------------------------------*//

//--API 7--//

const api7Result = (likesNames) => {
  return {
    likes: likesNames,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  async (request, response) => {
    let { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;

    const getUser = `SELECT user_id FROM user where username='${username}';`;
    const getUserId = await db.get(getUser);
    //console.log(getUserId);
    const getFollowing = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getUserId.user_id};`;
    const getFollowingId = await db.all(getFollowing);
    //console.log(getFollowingId);
    const getFollowingArray = getFollowingId.map((eachUser) => {
      return eachUser.following_user_id;
    });
    //console.log(getFollowingArray);

    const getTweetQuery = `SELECT tweet_id FROM tweet WHERE user_id in (${getFollowingArray})`;
    const getTweetId = await db.all(getTweetQuery);
    const getTweetIdArray = getTweetId.map((eachTweet) => eachTweet.tweet_id);
    console.log(getTweetIdArray);

    if (getTweetIdArray.includes(parseInt(tweetId))) {
      const likesQuery = `SELECT user.username AS likes FROM like INNER JOIN user
    ON user.user_id=like.user_id WHERE like.tweet_id=${tweetId};`;

      const likesNames = await db.all(likesQuery);
      // console.log(likesNames);

      const likeNameQuery = likesNames.map((eachLike) => eachLike.likes);

      response.send(api7Result(likeNameQuery));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//*----------------------------------------------------------------------*//

//--API 8--//

const api8Result = (replyNames) => {
  return {
    replies: replyNames,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  async (request, response) => {
    let { tweetId } = request.params;
    // console.log(tweetId);
    let { username } = request;

    const getUser = `SELECT user_id FROM user where username='${username}';`;
    const getUserId = await db.get(getUser);
    //console.log(getUserId);
    const getFollowing = `SELECT following_user_id FROM follower 
  WHERE follower_user_id=${getUserId.user_id};`;
    const getFollowingId = await db.all(getFollowing);
    //console.log(getFollowingId);
    const getFollowingArray = getFollowingId.map((eachUser) => {
      return eachUser.following_user_id;
    });
    //console.log(getFollowingArray);

    const getTweetQuery = `SELECT tweet_id FROM tweet WHERE user_id in (${getFollowingArray})`;
    const getTweetId = await db.all(getTweetQuery);
    const getTweetIdArray = getTweetId.map((eachTweet) => eachTweet.tweet_id);
    // console.log(getTweetIdArray);

    if (getTweetIdArray.includes(parseInt(tweetId))) {
      const likesQuery = `SELECT user.name AS name,reply.reply AS reply FROM reply INNER JOIN user
    ON user.user_id=reply.user_id WHERE reply.tweet_id=${tweetId};`;

      const replyNames = await db.all(likesQuery);
      // console.log(replyNames);

      response.send(api8Result(replyNames));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//*----------------------------------------------------------------------*//

//--API 9--//

app.get("/user/tweets/", authenticationToken, async (request, response) => {
  const myTweets = await db.all(`
    select 
    tweet.tweet,
    count(distinct like.like_id) as likes,
    count(distinct reply.reply_id) as replies,
    tweet.date_time as dateTime
    from
    tweet
    left join like on tweet.tweet_id = like.tweet_id
    left join reply on tweet.tweet_id = reply.tweet_id
    where tweet.user_id = (select user_id from user where username = "${request.username}")
    group by tweet.tweet_id;
    `);
  response.send(
    myTweets.map((item) => {
      const { ...rest } = item;
      return { ...rest };
    })
  );
});

//*----------------------------------------------------------------------*//

//--API 10--UPDATE-API--//

app.post("/user/tweets/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  const { tweet } = request.body;
  //console.log(tweet);
  //const currentDate = format(new Date(), "yyyy-MM-dd HH-mm-ss");
  const currentDate = new Date();
  //console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `
  INSERT INTO tweet(tweet, user_id, date_time) 
  VALUES ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

//*----------------------------------------------------------------------*//

/*
//to check if the tweet got updated
app.get("/tweets/", authenticationToken, async (request, response) => {
  const requestQuery = `select * from tweet;`;
  const responseResult = await db.all(requestQuery);
  response.send(responseResult);
});*/

//*----------------------------------------------------------------------*//

//--API 11--DELETE-API--//

app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    //console.log(getUserId.user_id);
    //tweets made by the user
    const getUserTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map(
      (eachTweetId) => eachTweetId.tweet_id
    );
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//*----------------------------------------------------------------------*//
module.exports = app;
