import { Hono } from 'hono'
import allRoutes from './routes';
import { cors } from 'hono/cors';

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
});
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS","PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);
app.route('/api',allRoutes);

export default app
