const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticationToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let Token;
  if (authHeader !== undefined) {
    Token = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(400);
    response.send("Invalid jwtToken");
  } else {
    jwt.verify(Token, "secretKey", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid User");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};


// User Register API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
    SELECT 
      * 
    FROM 
      user 
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (username, name, password, gender, location)
     VALUES
      (
       '${username}',
       '${name}',
       '${hashedPassword}',
       '${gender}',
       '${location}'  
      );`;
    await db.run(createUserQuery);
    response.send("User created successfully");
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secretKey");
      response.send({ jwtToken });
      response.send("Login Success!");
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Get profile

app.get("/profile/", authenticationToken, async (request, response) => {
  let { username } = request;
  const selectedUserQuery = `
    select * from user where username = '${username}';
    `;
  const userDetails = await db.get(selectedUserQuery);
  response.send(userDetails);
});

// Get all states
app.get("/states/", authenticationToken, async (request, response) => {
  const getBooksQuery = `
                SELECT
                    *
                FROM
                    state
                `;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

// Get a particular state
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getBooksQuery = `
                SELECT
                    *
                FROM
                    state
                WHERE 
      state_id = ${stateId}
                `;
  const booksArray = await db.get(getBooksQuery);
  response.send(booksArray);
});

// Create district

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
            INSERT INTO
                district (district_name, state_id, cases, cured, active, deaths)
            VALUES
                (
                '${districtName}',
                ${stateId},
                ${cases},
                ${cured},
                ${active} ,
                ${deaths}
                );`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// Get a particular district

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getBooksQuery = `
                SELECT
                    *
                FROM
                    district
                WHERE 
      district_id = ${districtId}
                `;
    const booksArray = await db.get(getBooksQuery);
    response.send(booksArray);
  }
);

// delete a district

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

/// UPDATE District

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const getBooksQuery = `
                UPDATE district 
                SET 
                district_name='${districtName}',
                state_id=${stateId},
                cases=${cases},
                cured=${cured},
                active=${active} ,
                deaths=${deaths} 
                WHERE 
                district_id = ${districtId};
                
                `;
    const booksArray = await db.run(getBooksQuery);
    response.send("District Details Updated");
  }
);

// Get stats

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getBooksQuery = `
                SELECT
                    SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive,SUM(deaths) AS totalDeaths 
                FROM
                    state NATURAL JOIN district 
                WHERE 
      state_id = ${stateId}
      GROUP BY state_id
                `;
    const booksArray = await db.get(getBooksQuery);
    response.send(booksArray);
  }
);
