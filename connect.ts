import * as path from "path";
import * as fs from "fs";

import { Session } from "./session";

if (process.platform !== "darwin") {
  throw new Error("This CLI only supports Mac for now");
}

const homedir = require("os").homedir();

const connectionFileDirectory = path.join(
  homedir,
  "Library",
  "Jupyter",
  "runtime"
);

export async function acquireSession(connectionFile?: string) {
  if (connectionFile === "--random") {
    const files = (
      await fs.promises.readdir(connectionFileDirectory)
    ).filter(x => /kernel.*\.json/.test(x));
    connectionFile = files[Math.floor(Math.random() * files.length)];
    if (!connectionFile) {
      throw new Error(
        "Run `jupyter console --kernel python3` in another terminal first"
      );
    }
  }

  if (!connectionFile || connectionFile.length <= 0) {
    throw new Error("need a connection file");
  }

  const connectionFilePath = path.join(connectionFileDirectory, connectionFile);

  const connectionInfo = JSON.parse(
    (await fs.promises.readFile(connectionFilePath)).toString()
  );

  const session = new Session(connectionInfo);
  return session;
}
