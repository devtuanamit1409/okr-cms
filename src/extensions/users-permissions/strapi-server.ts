import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
module.exports = (plugin) => {
  plugin.controllers.user.find = async (ctx) => {
    const { page = 1, pageSize = 10 } = ctx.query.pagination || {};
    const { filters } = ctx.query || {};

    // Tính toán offset dựa trên page và pageSize
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

    // Lấy tổng số user
    const totalUsers = await strapi.db
      .query("plugin::users-permissions.user")
      .count({
        where: filters,
      });

    // Lấy danh sách user với limit, offset và populate đầy đủ các quan hệ
    const users = await strapi.db
      .query("plugin::users-permissions.user")
      .findMany({
        where: filters,
        limit: parseInt(pageSize, 10),
        offset: offset,
        populate: {
          role: true, // Populate role relation
          postion: true, // Populate position relation (nếu có)
          tasks: true, // Populate tasks relation (nếu có)
        },
      });

    // Trả về kết quả
    ctx.body = {
      data: users,
      meta: {
        pagination: {
          page: parseInt(page, 10),
          pageSize: parseInt(pageSize, 10),
          total: totalUsers,
        },
      },
    };
  };
  plugin.controllers.user.findOne = async (ctx) => {
    const { id } = ctx.params; // Lấy ID từ params
    if (!id) {
      return ctx.badRequest("Missing ID parameter");
    }

    try {
      // Lấy thông tin user cụ thể với populate đầy đủ các quan hệ
      const user = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id },
          populate: {
            role: true, // Populate role relation
            postion: true, // Populate position relation
            tasks: true, // Populate tasks relation
          },
        });

      if (!user) {
        return ctx.notFound("User not found");
      }

      // Trả về user với các trường được populate
      ctx.body = {
        data: user,
      };
    } catch (error) {
      ctx.internalServerError("Error retrieving user");
    }
  };

  plugin.controllers.user.getUserTasksByDate = async (ctx) => {
    try {
      const { id } = ctx.params;
      const { date } = ctx.query;

      if (!id || !date) {
        return ctx.badRequest("User ID và ngày là bắt buộc.");
      }

      const user = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id },
          populate: ["tasks"],
        });

      if (!user) {
        return ctx.notFound("User không tồn tại.");
      }

      // Tạo khoảng thời gian bắt đầu và kết thúc của ngày
      const startOfDay = dayjs(date).startOf("day").utcOffset(7).toISOString();
      const endOfDay = dayjs(date).endOf("day").utcOffset(7).toISOString();

      // Lọc task theo `createdAt` thay vì `publishedAt`
      const tasks = user.tasks.filter((task: any) => {
        return task.createdAt >= startOfDay && task.createdAt <= endOfDay;
      });

      return ctx.send({
        userId: id,
        date,
        tasks,
      });
    } catch (error) {
      console.error("Lỗi khi lấy task của user:", error);
      return ctx.internalServerError("Đã xảy ra lỗi khi lấy task.");
    }
  };

  plugin.routes["content-api"].routes.push({
    method: "GET",
    path: "/users/:id/tasks-by-date",
    handler: "user.getUserTasksByDate",
    config: {
      prefix: "",
    },
  });
  return plugin;
};
