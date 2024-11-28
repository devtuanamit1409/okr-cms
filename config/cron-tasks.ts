import { Strapi } from "@strapi/strapi";
import dayjs from "dayjs";
import fs from "fs";
import path from "path";

export default {
  /**
   * Cron job để kiểm tra và tạo task mới cho user với repeat = true.
   * Chạy hàng ngày lúc 00:00.
   */
  repeatTaskCreation: {
    task: async ({ strapi }: { strapi: Strapi }) => {
      const today = new Date();
      const yesterday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 1
      ); // Ngày hôm qua
      const startOfYesterday = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate()
      );
      const endOfYesterday = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate() + 1
      );

      try {
        // Lấy tất cả task của ngày hôm qua có repeat = true
        const tasksToRepeat = await strapi.db.query("api::task.task").findMany({
          where: {
            repeat: true,
            createdAt: {
              $gte: startOfYesterday.toISOString(), // Bắt đầu ngày hôm qua
              $lt: endOfYesterday.toISOString(), // Kết thúc ngày hôm qua
            },
          },
        });

        console.log("Tasks cần lặp lại:", tasksToRepeat);

        // Duyệt qua các task và tạo task mới cho user liên quan
        for (const task of tasksToRepeat) {
          if (!task.idUser) {
            console.warn(`Task ${task.id} không có idUser liên kết. Bỏ qua.`);
            continue;
          }

          // Tạo task mới
          await strapi.db.query("api::task.task").create({
            data: {
              title: task.title, // Sao chép tiêu đề
              description: task.description, // Sao chép mô tả
              Tags: "In progress", // Trạng thái mặc định
              repeat: task.repeat, // Giữ nguyên trạng thái repeat
              progress: 0, // Reset tiến độ về 0
              completion_time: today.toISOString().split("T")[0], // Ngày hôm nay
              idUser: task.idUser, // Gắn đúng user (idUser là number)
              publishedAt: new Date(),
            },
          });

          console.log(`Task mới đã được tạo cho user ID: ${task.idUser}`);
        }

        console.log(
          `Cron job thành công: Đã xử lý ${tasksToRepeat.length} task cần lặp lại.`
        );
      } catch (error) {
        console.error("Lỗi khi chạy cron job:", error);
      }
    },
    options: {
      rule: "0 0 * * *", // Chạy vào 00:00 mỗi ngày
      tz: "Asia/Ho_Chi_Minh", // Đặt múi giờ
    },
  },
  notifyIncompleteTasks: {
    task: async ({ strapi }: { strapi: Strapi }) => {
      try {
        const users = await strapi.db
          .query("plugin::users-permissions.user")
          .findMany({
            populate: ["tasks"],
          });

        console.log(`Found ${users.length} users to process.`);

        for (const user of users) {
          if (!user.tasks || user.tasks.length === 0) {
            console.log(`User ID ${user.id} has no tasks. Skipping.`);
            continue;
          }

          const incompleteTasks = user.tasks.filter(
            (task) => task.Tags !== "Done"
          );

          if (incompleteTasks.length > 0) {
            const taskList = incompleteTasks
              .map((task) => `<li>${task.title}: ${task.description}</li>`)
              .join("");

            // Đọc nội dung template HTML
            const templatePath = path.join(
              __dirname,
              "../../email-templates/taskReminder.html"
            );
            const template = fs.readFileSync(templatePath, "utf-8");

            // Thay thế các placeholder bằng dữ liệu thực tế
            const emailContent = template
              .replace("{{username}}", user.name)
              .replace("{{taskList}}", taskList);

            try {
              await strapi.plugins["email"].services.email.send({
                from: "nguyentuanamit@gmail.com",
                to: user.email,
                subject: "Nhắc nhở: Bạn có task chưa hoàn thành!",
                html: emailContent, // Gửi email với nội dung HTML
              });

              console.log(
                `Email đã gửi đến ${user.email} với ${incompleteTasks.length} task chưa hoàn thành.`
              );
            } catch (emailError) {
              console.error(
                `Lỗi khi gửi email đến: ${user.email}, bỏ qua user này.`,
                emailError
              );
            }
          }
        }

        console.log("Cron job notifyIncompleteTasks đã chạy thành công.");
      } catch (error) {
        console.error("Lỗi khi chạy cron job notifyIncompleteTasks:", error);
      }
    },
    options: {
      rule: "0 20 * * *",
      tz: "Asia/Ho_Chi_Minh",
    },
  },

  // createDailyGoal: {
  //   task: async ({ strapi }: { strapi: Strapi }) => {
  //     try {
  //       const users = await strapi.db
  //         .query("plugin::users-permissions.user")
  //         .findMany({
  //           populate: ["goalDaily"], // Populate để lấy các goalDaily đã có
  //         });

  //       console.log(`Found ${users.length} users for daily goal creation.`);

  //       const today = new Date().toISOString().split("T")[0]; // Lấy ngày hôm nay (YYYY-MM-DD)

  //       for (const user of users) {
  //         // Kiểm tra nếu user chưa có goalDaily hợp lệ cho ngày hôm nay
  //         const hasTodayGoal = user.goalDaily?.some((goal) => {
  //           if (!goal.createdAt) {
  //             console.warn(
  //               `Goal in user ID ${user.id} missing createdAt field.`
  //             );
  //             return false;
  //           }

  //           const createdAtDate = new Date(goal.createdAt);
  //           if (isNaN(createdAtDate.getTime())) {
  //             console.warn(
  //               `Invalid createdAt value in goal for user ID ${user.id}`
  //             );
  //             return false;
  //           }

  //           return createdAtDate.toISOString().split("T")[0] === today;
  //         });

  //         if (!hasTodayGoal) {
  //           // Thêm một mục tiêu mới cho ngày hôm nay
  //           const updatedGoalDaily = [
  //             ...(user.goalDaily || []), // Các mục goalDaily cũ
  //             {
  //               name: `Goal for ${today}`, // Tên mục tiêu
  //               createdAt: new Date().toISOString(), // Ngày tạo
  //             },
  //           ];

  //           // Cập nhật lại danh sách goalDaily của user
  //           await strapi.db.query("plugin::users-permissions.user").update({
  //             where: { id: user.id },
  //             data: {
  //               goalDaily: updatedGoalDaily,
  //             },
  //           });

  //           console.log(`Created daily goal for user ID: ${user.id}`);
  //         } else {
  //           console.log(
  //             `User ID ${user.id} already has a daily goal for today. Skipping.`
  //           );
  //         }
  //       }

  //       console.log("Cron job createDailyGoal ran successfully.");
  //     } catch (error) {
  //       console.error("Error running cron job createDailyGoal:", error);
  //     }
  //   },
  //   options: {
  //     rule: "* * * * *", // Chạy mỗi phút để test
  //     tz: "Asia/Ho_Chi_Minh", // Đặt múi giờ
  //   },
  // },
};
