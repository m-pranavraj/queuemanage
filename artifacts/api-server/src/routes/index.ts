import { Router, type IRouter } from "express";
import healthRouter from "./health";
import samparkRouter from "./sampark";

const router: IRouter = Router();

router.use(healthRouter);
router.use(samparkRouter);

export default router;
