import { Strapi } from "@strapi/strapi";

declare module "@strapi/strapi" {
  export interface User {
    tasks?: Array<{
      id: number;
      title: string;
      createdAt: string;
      publishedAt: string;
      description: string;
      Tags: string;
      repeat: boolean;
      progress: number;
      completion_time: string;
      idUser: number;
    }>;
  }
}
