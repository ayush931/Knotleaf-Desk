import { JWT_TOKEN } from "@repo/backend-common/config";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function middleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["authorization"] ?? "";

  try {
    const decode = jwt.verify(token, JWT_TOKEN);

    if (decode && typeof decode !== "string" && decode.userId) {
      //@ts-ignore
      req.userId = decode.userId;
      next();
    } else {
      res.status(403).json({
        message: "Unauthorized",
      });
    }
  } catch (error) {
    res.status(403).json({
      message: "Unauthorized",
    });
  }
}
