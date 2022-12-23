const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

module.exports = app;

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
    process.exit(0);
  }
};

initializeDBAndServer();

//Middleware Function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const jwtVerifyToken = jwt.verify(
      jwtToken,
      "SECRET_TOKEN",
      async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      }
    );
  }
};

//Convert DBObject to ResponseObject

const convertStateDBObjectToResponseObject = (DBObject) => {
  return {
    stateId: DBObject.state_id,
    stateName: DBObject.state_name,
    population: DBObject.population,
  };
};

//Convert District DBobject

const convertDistrictDBObjectToResponseObject = (DBObject) => {
  return {
    districtName: DBObject.district_name,
    stateId: DBObject.state_id,
    cases: DBObject.cases,
    cured: DBObject.cured,
    active: DBObject.active,
    deaths: DBObject.deaths,
  };
};

//Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUserDetails = `

SELECT 

* 

FROM 
user
WHERE username='${username}';`;

  const dbUser = await db.get(getUserDetails);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const verifyUser = await bcrypt.compare(password, dbUser.password);
    if (verifyUser === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET States API

app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStates = `

SELECT 
* 
FROM 
state;`;

  const statesData = await db.all(getAllStates);
  response.send(
    statesData.map((eachState) =>
      convertStateDBObjectToResponseObject(eachState)
    )
  );
});

//GET State API

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const getStateDetails = `
SELECT 
* 
FROM 
state
WHERE state_id=${stateId};`;

  const specificStateDetails = await db.get(getStateDetails);
  response.send(convertStateDBObjectToResponseObject(specificStateDetails));
});

//Create District API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const createNewDistrict = `
    
    INSERT INTO 
    district(district_name,state_id,cases,cured,active,deaths)
    VALUES(
   '${districtName}',
   ${stateId},
   ${cases},
   ${cured},
   ${active},
   ${deaths}
    );`;
  await db.run(createNewDistrict);
  response.send("District Successfully Added");
});

//GET district API

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetails = `
SELECT 
* 
FROM
district
WHERE 
district_id=${districtId};`;

    const districtDetails = await db.get(getDistrictDetails);
    response.send(convertDistrictDBObjectToResponseObject(districtDetails));
  }
);

//DELETE District API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `

DELETE FROM district
WHERE district_id=${districtId};`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

//Update District API

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;

    const updateDistrictDetails = `

UPDATE district
SET 

district_name='${districtName}',
state_id=${stateId},
cases=${cases},
cured=${cured},
active=${active},
deaths=${deaths}

WHERE district_id=${districtId};`;

    await db.run(updateDistrictDetails);
    response.send("District Details Updated");
  }
);

//GET Stats API

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsOfState = `

SELECT 
SUM(cases) ,
SUM(cured) ,
SUM(active) ,
SUM(deaths) 

FROM 
state NATURAL JOIN district
WHERE
state.state_id=${stateId};`;

    const stats = await db.get(getStatsOfState);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
