import { type Request, type Response, type NextFunction } from "express";
import { verifyToken } from "../lib/auth-utils";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    fullName: string;
  };
}

export function requireAuth(allowedRoles?: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Access denied. No token provided." });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({ error: "Access denied. Invalid or expired token." });
      return;
    }

    // Attach user to request
    (req as any).user = decoded;

    // Check roles if specified
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(decoded.role)) {
        res.status(403).json({ error: "Access forbidden. Insufficient permissions." });
        return;
      }
    }

    next();
  };
}
