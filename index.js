const crypt = require("crypto");

const WIRE_PROTOCOL_DELIMITER = "<IDS|MSG>";

function toJSON(value) {
  return JSON.parse(value.toString());
}

function initializeMessage(_message) {
  const message = Object.assign(
    {},
    {
      header: {},
      parent_header: {},
      metadata: {},
      content: {},
      idents: [],
      buffers: []
    },
    _message
  );

  return message;
}

function identifyHMACScheme(_scheme) {
  let scheme = _scheme;
  switch (_scheme) {
    case "hmac-sha256":
      scheme = "sha256";
      break;
  }

  return scheme;
}

function decode(messageFrames, _scheme = "sha256", key = "") {
  var i = 0;
  const idents = [];
  for (i = 0; i < messageFrames.length; i++) {
    var frame = messageFrames[i];
    if (frame.toString() === WIRE_PROTOCOL_DELIMITER) {
      break;
    }
    idents.push(frame);
  }

  if (messageFrames.length - i < 5) {
    throw new Error("Message Decoding: Not enough message frames");
  }

  if (messageFrames[i].toString() !== WIRE_PROTOCOL_DELIMITER) {
    throw new Error("Message Decoding: Missing delimiter");
  }

  if (key) {
    const scheme = identifyHMACScheme(_scheme);
    var obtainedSignature = messageFrames[i + 1].toString();

    var hmac = crypt.createHmac(scheme, key);
    hmac.update(messageFrames[i + 2]);
    hmac.update(messageFrames[i + 3]);
    hmac.update(messageFrames[i + 4]);
    hmac.update(messageFrames[i + 5]);
    var expectedSignature = hmac.digest("hex");

    if (expectedSignature !== obtainedSignature) {
      throw new Error(`Message Decoding: Incorrect;
Obtained "${obtainedSignature}"
Expected "${expectedSignature}"`);
    }
  }

  var message = initializeMessage({
    idents: idents,
    header: toJSON(messageFrames[i + 2]),
    parent_header: toJSON(messageFrames[i + 3]),
    content: toJSON(messageFrames[i + 5]),
    metadata: toJSON(messageFrames[i + 4]),
    buffers: Array.prototype.slice.apply(messageFrames, [i + 6])
  });

  return message;
}

function encode(_message, _scheme = "sha256", key = "") {
  // Ensure defaults are set for the message
  const message = initializeMessage(_message);

  const scheme = identifyHMACScheme(_scheme);

  const idents = message.idents;

  const header = Buffer.from(JSON.stringify(message.header), "utf-8");
  const parent_header = Buffer.from(
    JSON.stringify(message.parent_header),
    "utf-8"
  );
  const metadata = Buffer.from(JSON.stringify(message.metadata), "utf-8");
  const content = Buffer.from(JSON.stringify(message.content), "utf-8");

  let signature = "";
  if (key) {
    const hmac = crypt.createHmac(scheme, key);
    hmac.update(header);
    hmac.update(parent_header);
    hmac.update(metadata);
    hmac.update(content);
    signature = hmac.digest("hex");
  }

  var response = idents
    .concat([
      // idents
      Buffer.from(WIRE_PROTOCOL_DELIMITER), // delimiter
      Buffer.from(signature), // HMAC signature
      header, // header
      parent_header, // parent header
      metadata, // metadata
      content // content
    ])
    .concat(message.buffers);

  return response;
}

module.exports = {
  decode,
  encode
};
