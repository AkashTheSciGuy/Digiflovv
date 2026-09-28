"use strict";

const { neon } = require("@neondatabase/serverless");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is required."
  );
}

const sql = neon(databaseUrl);

module.exports = {
  sql
};