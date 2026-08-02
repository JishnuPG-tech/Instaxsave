import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import resolveRouter from "./resolve.js";
import downloadRouter from "./download.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(resolveRouter);
router.use(downloadRouter);

export default router;
