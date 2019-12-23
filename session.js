const { decode, encode } = require("./index");
const uuidv4 = require("uuid/v4");

const zmq = require("zeromq");

class Session {
  constructor(connectionInfo) {
    this.connectionInfo = connectionInfo;

    this.sessionID = uuidv4();

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
  }

  async sendOnControl(msg_type, content = {}) {
    const message = {
      header: {
        msg_id: uuidv4(),
        username: "nteract",
        session: this.sessionID,
        date: new Date().toISOString(),
        version: "5.0",
        msg_type
      },
      content
    };

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
        username: "nteract",
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
  }
}

module.exports = {
  Session
};
