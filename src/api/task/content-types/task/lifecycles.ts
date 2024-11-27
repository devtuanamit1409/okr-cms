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
      data.Tags = "In progress";
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
    const { data } = event.params;

    // Nếu progress đạt 100%, tự động cập nhật Tags và completion_time
    if (data.progess === 100) {
      data.Tags = "Done"; // Gán trạng thái thành "Done"
      data.completion_time = new Date(); // Gán completion_time là thời điểm hiện tại
    } else {
      data.Tags = "In progress";
      data.completion_time = null;
    }
  },
};
