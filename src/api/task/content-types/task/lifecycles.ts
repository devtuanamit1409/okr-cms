const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);
module.exports = {
  /**
   * Triggered before creating a task.
   * @param {Object} event - The event object contains information about the task being created.
   */
  async beforeCreate(event) {
    const { data } = event.params;

    // Nếu trường progess không được cung cấp, đặt mặc định là 0 và Tags là "None"
    if (data.progess === undefined) {
      data.progess = 0;
      data.Tags = "None";
    }

    // Nếu trường hours tồn tại, chuyển đổi từ chuỗi sang số và tính toán
    if (data.hours !== undefined) {
      const hoursInMinutes = parseFloat(data.hours); // Chuyển đổi chuỗi sang số
      if (!isNaN(hoursInMinutes)) {
        data.hours = hoursInMinutes / 60; // Chuyển đổi phút sang giờ
      } else {
        data.hours = 0; // Nếu không hợp lệ, đặt mặc định là 0
      }
    }
  },

  async afterCreate(event) {
    const { result } = event; // Kết quả sau khi task được tạo
    const { idUser } = result; // Lấy ID user từ task đã được tạo

    // Nếu `user` là ID, không cần `user.id`
    if (idUser) {
      // Lấy thông tin user hiện tại
      const existingUser = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: idUser },
          populate: ["tasks"], // Populate để lấy danh sách task hiện tại
        });

      if (existingUser) {
        // Cập nhật user bằng cách thêm task vào danh sách tasks
        await strapi.db.query("plugin::users-permissions.user").update({
          where: { id: idUser },
          data: {
            tasks: [...(existingUser.tasks || []), result.id], // Thêm ID của task mới vào danh sách
          },
        });
      }
    }
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;

    // Kiểm tra nếu `progess` đạt 100%
    if (data.progess === 100) {
      // Nếu Tags không được gửi từ frontend, tự động gán là "Done"
      if (!data.Tags) {
        data.Tags = "Done";
      }
      data.completion_time = dayjs().utc().toDate();

      // Lấy thông tin task hiện tại
      const taskId = where.id;
      const taskDetails = await strapi.db.query("api::task.task").findOne({
        where: { id: taskId },
      });

      if (taskDetails && taskDetails.startAt) {
        const startTime = new Date(taskDetails.startAt);
        const completionTime = data.completion_time;
        const diffInMilliseconds =
          completionTime.getTime() - startTime.getTime();

        // Quy đổi ra số giờ dạng thập phân
        const diffInHoursDecimal = diffInMilliseconds / (1000 * 60 * 60);
        data.timeDone = parseFloat(diffInHoursDecimal.toFixed(2)); // Lưu dạng số
      }
    }

    // Xử lý trường hợp `progess` chưa đạt 100%
    else {
      // Nếu frontend gửi giá trị `Tags`, không ghi đè
      if (!data.Tags) {
        data.Tags = "In progress";
      }
      data.completion_time = null;
      data.timeDone = null; // Reset giá trị nếu chưa hoàn thành
    }

    // Gửi email nếu task đạt 100%
    if (data.Tags === "Done") {
      const adminUsers = await strapi.db
        .query("plugin::users-permissions.user")
        .findMany({
          where: { postion: { isAdmin: true } },
        });

      if (adminUsers.length > 0) {
        const emailAddresses = adminUsers.map((user) => user.email);

        // Gửi email bất đồng bộ
        setImmediate(async () => {
          try {
            await strapi.plugins["email"].services.email.send({
              to: emailAddresses,
              subject: "Thông báo: Task đã hoàn thành",
              html: `<p>Task đã được đánh dấu là "Done".</p>
                 <p><strong>Tên task:</strong> ${data.title}</p>
                 <p><strong>Thời gian thực tế làm:</strong> ${
                   data.timeDone || "N/A"
                 } giờ</p>
                 <p>Vui lòng kiểm tra hệ thống để biết thêm chi tiết.</p>`,
              text: `Task ${data.title} đã hoàn thành. Thời gian thực tế làm: ${
                data.timeDone || "N/A"
              } giờ`,
            });
          } catch (error) {
            strapi.log.error("Failed to send email:", error);
          }
        });
      }
    }
  },
};
