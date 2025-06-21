export default function generatePassword(length = 8) {
  const characters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // Removed confusing chars
  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters[randomIndex];
  }

  // Add a random suffix to increase uniqueness
  const timestampPart = Date.now().toString().slice(-3); // Last 3 digits of timestamp
  return `${password}${timestampPart}`; // e.g., "XDFK3R78-123"
}
  