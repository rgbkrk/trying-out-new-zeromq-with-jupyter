import { wireProtocol } from "@nteract/messaging";
import * as uuidv4 from "uuid/v4";
import * as zmq from "zeromq";

const { decode, encode } = wireProtocol;

console.log("uuidv4:::::", uuidv4());

export class Session {
  connectionInfo: any;

  sessionID: string;
  username: string;
  iopub_sock: zmq.Subscriber;
  shell_sock: zmq.Dealer;
  control_sock: zmq.Dealer;
  hb_sock: zmq.Dealer;

  constructor(connectionInfo) {
    this.connectionInfo = connectionInfo;

    this.sessionID = uuidv4();

    console.log("SESSION ID IS", this.sessionID);

    this.username = "nteract";

    this.iopub_sock = new zmq.Subscriber();
    this.iopub_sock.connect(
      `${connectionInfo.transport}://${connectionInfo.ip}:${connectionInfo.iopub_port}`
    );
    this.iopub_sock.subscribe("");

    this.shell_sock = new zmq.Dealer();
    this.shell_sock.connect(
      `${connectionInfo.transport}://${connectionInfo.ip}:${connectionInfo.shell_port}`
    );

    this.control_sock = new zmq.Dealer();
    this.control_sock.connect(
      `${connectionInfo.transport}://${connectionInfo.ip}:${connectionInfo.control_port}`
    );

    this.hb_sock = new zmq.Dealer();
    this.hb_sock.connect(
      `${connectionInfo.transport}://${connectionInfo.ip}:${connectionInfo.hb_port}`
    );
  }

  async echo(content) {
    await this.hb_sock.send(content);
    const response = await this.hb_sock.receive();
    return response.map(x => x.toString());
  }

  async sendOnControl(msg_type, content = {}) {
    const message = {
      header: {
        msg_id: uuidv4(),
        username: this.username,
        session: this.sessionID,
        date: new Date().toISOString(),
        version: "5.0",
        msg_type
      },
      content
    };

    let rawFrames;

    try {
      await this.control_sock.send(
        encode(
          message,
          this.connectionInfo.key,
          this.connectionInfo.signature_scheme
        )
      );

      rawFrames = await this.control_sock.receive();
    } catch (err) {
      console.error(err);
      throw err;
    }

    const reply = decode(
      rawFrames,
      this.connectionInfo.key,
      this.connectionInfo.signature_scheme
    );

    return reply;
  }

  async send(msg_type, content = {}) {
    const message = {
      header: {
        msg_id: uuidv4(),
        username: this.username,
        session: this.sessionID,
        date: new Date().toISOString(),
        version: "5.0",
        msg_type
      },
      content
    };

    await this.shell_sock.send(
      encode(
        message,
        this.connectionInfo.key,
        this.connectionInfo.signature_scheme
      )
    );

    const rawFrames = await this.shell_sock.receive();

    const reply = decode(
      rawFrames,
      this.connectionInfo.key,
      this.connectionInfo.signature_scheme
    );

    return reply;
  }

  async *iopub() {
    for await (const [topic, ...frames] of this.iopub_sock) {
      const message = decode(
        frames,
        this.connectionInfo.key,
        this.connectionInfo.signature_scheme
      );
      yield message;
    }
  }

  close() {
    this.iopub_sock.close();
    this.shell_sock.close();
    this.control_sock.close();
    this.hb_sock.close();
  }
}
