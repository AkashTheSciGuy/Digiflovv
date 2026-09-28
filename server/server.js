"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;


app.disable("x-powered-by");


app.use(
  express.json({
    limit: "100kb"
  })
);


app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb"
  })
);


app.use(
  express.static(
    path.join(__dirname, "..", "dist")
  )
);


app.get(
  "/api/health",
  async (req, res) => {
    res.json({
      ok: true,
      service: "digiflovv"
    });
  }
);


app.get(
  "*",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "..",
        "dist",
        "index.html"
      )
    );
  }
);


app.listen(
  PORT,
  () => {
    console.log(
      `DigiFlovv running on http://localhost:${PORT}`
    );
  }
);