//@ts-check

const crypto = require("crypto");

const WIRE_PROTOCOL_DELIMITER = "<IDS|MSG>";

function toJSON(value) {
  return JSON.parse(value.toString());
}

function initializeMessage(_message) {
  return Object.assign(
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

/**
 *
 * @param {Array<Buffer>} messageFrames
 * @param {string} _scheme
 * @param {string} key
 */
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

    var hmac = crypto.createHmac(scheme, key);
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

  const header = JSON.stringify(message.header);
  const parent_header = JSON.stringify(message.parent_header);
  const metadata = JSON.stringify(message.metadata);
  const content = JSON.stringify(message.content);

  let signature = "";
  if (key) {
    const hmac = crypto.createHmac(scheme, key);
    hmac.update(Buffer.from(header, "utf-8"));
    hmac.update(Buffer.from(parent_header, "utf-8"));
    hmac.update(Buffer.from(metadata, "utf-8"));
    hmac.update(Buffer.from(content, "utf-8"));
    signature = hmac.digest("hex");
  }

  var response = idents
    .concat([
      // idents
      WIRE_PROTOCOL_DELIMITER, // delimiter
      signature, // HMAC signature
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
