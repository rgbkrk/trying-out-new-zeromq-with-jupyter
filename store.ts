import { readFileSync } from "fs";

import * as pg from "pg";

import * as path from "path";
import { homedir } from "os";

const certsDir = path.join(homedir(), "cockroach-data", "certs");

var config = {
  user: "maxroach",
  host: "localhost",
  database: "bank",
  port: 26257,
  ssl: {
    ca: readFileSync(path.join(certsDir, "ca.crt")).toString(),
    key: readFileSync(path.join(certsDir, "client.maxroach.key")).toString(),
    cert: readFileSync(path.join(certsDir, "client.maxroach.crt")).toString()
  }
};
