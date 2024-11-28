const fs = require("fs");
const path = require("path");
module.exports = {
  /**
   * Triggered before creating a task.
   * @param {Object} event - The event object contains information about the task being created.
   */
  async beforeCreate(event) {
    const { data } = event.params;

    // Nếu trường progess không được cung cấp, đặt mặc định là 0
    if (data.progess === undefined) {
      data.progess = 0;
      data.Tags = "None";
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

    // Nếu progress đạt 100%, tự động cập nhật Tags, completion_time và timeDone
    if (data.progess === 100) {
      data.Tags = "Done"; // Gán trạng thái thành "Done"
      data.completion_time = new Date(); // Gán completion_time là thời điểm hiện tại

      // Lấy thông tin task hiện tại
      const taskId = where.id; // Lấy ID của task đang được cập nhật
      const taskDetails = await strapi.db.query("api::task.task").findOne({
        where: { id: taskId },
      });

      if (taskDetails && taskDetails.startAt) {
        // Tính số giờ và phút thực tế làm
        const startTime = new Date(taskDetails.startAt);
        const completionTime = data.completion_time;
        const diffInMilliseconds =
          completionTime.getTime() - startTime.getTime();

        // Quy đổi ra số giờ dạng thập phân
        const diffInHoursDecimal = diffInMilliseconds / (1000 * 60 * 60); // 1 giờ = 1000ms * 60 * 60

        // Làm tròn tới 2 chữ số thập phân
        const timeDoneFormatted = diffInHoursDecimal.toFixed(2) + " giờ";

        // Lưu giá trị vào trường timeDone
        data.timeDone = timeDoneFormatted;
      }

      // Lấy tất cả user có role `isAdmin = true`
      const adminUsers = await strapi.db
        .query("plugin::users-permissions.user")
        .findMany({
          where: { postion: { isAdmin: true } },
        });

      // Gửi email bất đồng bộ nếu có admin
      if (adminUsers.length > 0) {
        const emailAddresses = adminUsers.map((user) => user.email); // Lấy danh sách email

        // Dùng setImmediate để không chặn quy trình chính
        setImmediate(async () => {
          await strapi.plugins["email"].services.email.send({
            to: emailAddresses, // Gửi đến danh sách email
            subject: "Thông báo: Task đã hoàn thành",
            html: `<p>Task đã được đánh dấu là "Done".</p>
                 <p><strong>Tên task:</strong> ${taskDetails.name}</p>
                 <p><strong>Thời gian thực tế làm:</strong> ${data.timeDone}</p>
                 <p>Vui lòng kiểm tra hệ thống để biết thêm chi tiết.</p>`,
            text: `Task ${taskDetails.name} đã hoàn thành. Thời gian thực tế làm: ${data.timeDone}`,
          });
        });
      }
    } else {
      data.Tags = "In progress";
      data.completion_time = null;
      data.timeDone = null; // Reset giá trị nếu chưa hoàn thành
    }
  },
};
