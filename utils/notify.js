import admin from "firebase-admin";

const serviceAccount = {
  type: "service_account",
  project_id: "mywebapp-d7222",
  private_key_id: "f23ae68714b7f77cf7055d74b5439e6959f678ed",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDA4WkYa8PqMnRk\nn4Vl2//7hr/5SjPqjhRIy0W4CHdKkElDyHzM6vmunj5ku4UIMkAogt94BSGeQePg\nXre2kvzwUk8adM+nCFr4D+XApjFmVXWWFu89HcjY2QxFjLKv4vkIOBnPGHC0mA1h\n1c4s65XBRlyvoRNwIlO7EiExI0+AocgPNE3Duw0o7O4TV3dzb8V3E+U955ZLiEHH\n0B+6coRpUkRDJBgfX4knxm1WfZUp/WY9fw87SanPICS6jGrq906rVQZBGqhMg1Jv\ncAx6kTCdbPvtd2Ti7x2SpPf8RsC8fPtWIlo/dE5M21VvLMJb09FQiUDHSfQomOtJ\nzGHg2283AgMBAAECggEAHnCUhvOe8tYtSKIPn0XV7h/+f70RA2/nzfMymLrRT2sE\n/QBmMxV++8ANOxWIXFpIhibdVfzX/ji02g3osr9w0WE+taoAtCzdOm/mg6hW0dPO\nimDVNyZ9B5KoMqO5TDPRtyqEvDUbDbfqHhTBhJUAyISuZP39P4Gost8cw5Coioqi\nMg+6sfalkaIma7jkR34EgXn6F51RAwgNOxpdyPtc66nuJ2uo0kUl6hfYGsFAWvX8\nF2zFNd1iAMAUpiBZO5MUYi08Whxt3LcMp+eN5+ZP8/rM2fvNv5gzhNL/Vct+FmTB\n10m3S40zLoewdV3GdrFWy+UCVfgJCoxMUYrz2KZRAQKBgQDlkfvRw/AttDbtLD6k\nYEQ8VwxRF8BTm4NWRon2KzPFb2hFiavJPDJuVjcMSHWrMPcL5WPUBHIyAseexDkv\nXVfvcfBc9uombaMPTbLhaUt1mzXXjEiyFnDYAgI0rzfWq5FgbFa3IkFdyxNN4EC8\n6Wm1lCdQiQA+xc80ug29e3+hAQKBgQDXFhZe25waruvBCfbJgMlt4uTb5rSPKCLp\nhWJwg2f3wm3b0xR2jrViv6EnbUg6U8FS7/4shEt8QAxnGayjaHRkYwOQl3b6vI9y\nps01LfhsS8U5QjkH0YG0i7F/mT08RLh+8Ft4R3l82JZ9Y+gLbNms++ECwPl+NXBk\ngqLfsZfYNwKBgAK5qu2gj9dbDlPedJfq9KRqvCCyUXwsmnCJwdWESccMPYalzb5D\n0q1wpJKmwY7Ys/YWMQsxSlHBqrD9z1f6mbKj/aB85eay4n6qA3edkmHBB/CZH7vN\nfGV0EKajddw8iStF3fmqlHASmxYPlXUoqDKZoaXZGoGkQ4NyufsH3koBAoGAHDOQ\nMVXYLQN8c+4rhpY1Uwwp989TI2Ye1cGge6IvMqQypV0S1My3acA4kCPbEZLDyW0g\nRZP/FcaMGcSbBz397N+yqvXBKvUoVd8bDvr9FK4GqRBOzACjYhni5xkfl1RnYHWB\neM7eVglMChrcZQsbq3vHMAY/cFXva65ZTr1JbJcCgYARFajsAG1H3cQR6Hq41ONI\nNSYDinrBXJ6zCy5yaJ/VcXc5xBT5a56cBaCy1Z6hlVcNt5DFLEIQdE45eKXNOnKe\n5LzYfsrHt/n9RvgYHcEJA0DFPl85yv3S0v7mSuc6bc4pgnMLIttku+eaKVDXhnhX\n961PFl7BlL4D34yU0FMQlA==\n-----END PRIVATE KEY-----\n",
  client_email:
    "firebase-adminsdk-fbsvc@mywebapp-d7222.iam.gserviceaccount.com",
  client_id: "116722752677810220276",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40mywebapp-d7222.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export function sendNotificationToClient(token, title, message) {
  const messagePayload = {
    notification: {
      title: title,
      body: message,
    },
    token: token,
  };

  admin
    .messaging()
    .send(messagePayload)
    .then((response) => {
      console.log("Successfully sent message:", response);
    })
    .catch((error) => {
      console.log("Error sending message:", error);
    });
}
