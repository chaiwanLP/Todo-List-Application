# Todo-List Application

Todo app แบบ full-stack: เพิ่ม / ลบ / ติ๊กงานเสร็จ ข้อมูลซิงก์กับ REST API และเก็บใน PostgreSQL รีเฟรชแล้วไม่หาย

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Angular 22 (standalone + signals), Tailwind CSS v4 (`@theme`), TypeScript |
| Backend | Node.js 24, Express 4, `pg` (PostgreSQL driver), CORS, dotenv |
| Database | PostgreSQL 16 (ผ่าน Docker) |
| Test | Vitest (`ng test`), Postman collection + Newman |

## โครงสร้าง

```
Todo-List-Application/
├── Todo-frontend/   # Angular app (port 4200)
│   └── src/app/     # app.ts/html, services/todo.service.ts, models/todo.model.ts
├── Todo-backend/    # Express API (port 3000)
│   ├── src/index.js
│   ├── src/routes/todos.js
│   ├── src/db.js
│   ├── init.sql
│   └── postman/Todo-API.postman_collection.json
└── README.md
```

## 1) เตรียม Database (PostgreSQL)

ต้องเปิด Docker Desktop ก่อน แล้วสั่งครั้งเดียว:

```powershell
docker run --name todo-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=todoapp -p 5432:5432 -d postgres:16
```

รันครั้งถัดไปแค่ `docker start todo-postgres`

## 2) รัน Backend

```powershell
cd Todo-backend
npm install
npm start
```

เช็ค: เปิด `http://localhost:3000/health` ต้องได้ `{"status":"ok"}`

ค่า config อยู่ใน `.env` (`DATABASE_URL`, `PORT=3000`, `CORS_ORIGIN=http://localhost:4200`)

### API Endpoints

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| GET | `/health` | เช็ค server |
| GET | `/api/todos` | ดึงรายการทั้งหมด |
| GET | `/api/todos/:id` | ดึง 1 รายการ |
| POST | `/api/todos` `{title}` | สร้าง (`201` + `{data}`) |
| PUT | `/api/todos/:id` `{title?, completed?}` | แก้ไข |
| PATCH | `/api/todos/:id/toggle` | สลับเสร็จ/ยังไม่เสร็จ |
| DELETE | `/api/todos/:id` | ลบ |

## 3) รัน Frontend

```powershell
cd Todo-frontend
npm install
ng serve
```

เปิด `http://localhost:4200/` ถ้า backend ดับจะขึ้นแถบแดง `ไม่สามารถโหลดรายการได้` แต่หน้าเว็บยังใช้งานโครงได้

### คำสั่งอื่น

```powershell
npm run build   # build production -> dist/
npm test        # unit test (Vitest)
```

## 4) ทดสอบ API ด้วย Postman

1. เปิด Postman → Import → เลือก `Todo-backend/postman/Todo-API.postman_collection.json`
2. ยิงตามลำดับ: `Health` → `Create todo` (`201`) → `List` → `Get one/Toggle/PUT` (เปลี่ยน `1` เป็น id ที่ได้) → `Delete` → `List` ซ้ำต้องหาย
3. แบบ CLI: `npx newman run Todo-backend/postman/Todo-API.postman_collection.json`

## หมายเหตุ

- Frontend ชี้ API ที่ `http://localhost:3000/api` (ดู `Todo-frontend/src/environments/environment.ts`)
- ฟีเจอร์หน้าเว็บ: filter ทั้งหมด/ทำอยู่/เสร็จ, ค้นหา, sort, dark mode, progress %, responsive มือถือ+เว็บ
- Created by [chaiwanlp](http://github.com/chaiwanlp)
