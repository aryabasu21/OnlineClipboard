import { customAlphabet } from "nanoid";

const codeAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const codeNano = customAlphabet(codeAlphabet, 5);
const linkNano = customAlphabet(codeAlphabet, 16);

export function generateSessionCode() {
  return codeNano();
}

export function generateLinkToken() {
  return linkNano();
}
