export default ({ env }) => ({
  "users-permissions": {
    config: {
      register: {
        allowedFields: ["phone", "postion", "name"], // Các trường bổ sung bạn muốn chấp nhận
      },
    },
  },
  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        host: "smtp.gmail.com", // Gmail SMTP host
        port: 465, // SSL port
        secure: true, // Kết nối bảo mật SSL
        auth: {
          user: env("SMTP_USERNAME"), // Email của bạn
          pass: env("SMTP_PASSWORD"), // App Password
        },
      },
      settings: {
        defaultFrom: env("SMTP_USERNAME"), // Địa chỉ gửi
        defaultReplyTo: env("SMTP_USERNAME"), // Địa chỉ nhận phản hồi
      },
    },
  },
});
