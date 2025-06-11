 export default function generatePassword(length = 6) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVW";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length); // Using Math.random for randomness
    password += characters[randomIndex];
  }
  return password;
}
