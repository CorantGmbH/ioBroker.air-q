var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var decryptAES256_exports = {};
__export(decryptAES256_exports, {
  decrypt: () => decrypt
});
module.exports = __toCommonJS(decryptAES256_exports);
var import_crypto_js = __toESM(require("crypto-js"));
function decrypt(msgb64, airqpass) {
  if (airqpass.length < 32) {
    for (let i = airqpass.length; i < 32; i++) {
      airqpass += "0";
    }
  } else if (airqpass.length > 32) {
    airqpass = airqpass.substring(0, 32);
  }
  const key = import_crypto_js.default.enc.Utf8.parse(airqpass);
  const ciphertext = import_crypto_js.default.enc.Base64.parse(msgb64);
  const iv = ciphertext.clone();
  iv.sigBytes = 16;
  iv.clamp();
  ciphertext.words.splice(0, 4);
  ciphertext.sigBytes -= 16;
  const decrypted = import_crypto_js.default.AES.decrypt(import_crypto_js.default.enc.Base64.stringify(ciphertext), key, {
    iv
  });
  try {
    return JSON.parse(decrypted.toString(import_crypto_js.default.enc.Utf8));
  } catch {
    return void 0;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  decrypt
});
//# sourceMappingURL=decryptAES256.js.map
