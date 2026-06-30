import { Hono } from "hono";
import auth from "./auth-route";
import storeApi from "./store-route";
import categoryApi from "./category-route";
import productApi from "./product-route";
import planApi from "./plan-route";
import adminStoresApi from "./admin-route";

const allRoutes = new Hono();

allRoutes.route('/auth', auth);
allRoutes.route('/store', storeApi);
allRoutes.route('/category', categoryApi);
allRoutes.route('/product', productApi);
allRoutes.route('/admin', adminStoresApi);
allRoutes.route('/plans',planApi);

export default allRoutes