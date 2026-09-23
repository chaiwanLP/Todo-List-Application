# Todo-List Application — Flowday

Todo app แบบ full-stack: เพิ่ม / หมวดหมู่ / กำหนดวัน-เวลา / สถานะ ต้องทำ→กำลังทำ→เสร็จ / เตือนเกินเวลา + ใกล้ถึงกำหนด ข้อมูลซิงก์ REST API เก็บใน PostgreSQL รีเฟรชแล้วไม่หาย

## Tech Stack

| ส่วน     | เทคโนโลยี                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| Frontend | Angular 22 (standalone + signals/computed/effect), Tailwind CSS v4 (`@theme`, dark variant), TypeScript, FormsModule |
| Backend  | Node.js 24, Express 4, `pg`, CORS, dotenv                                                                            |
| Database | PostgreSQL 16 (ผ่าน Docker)                                                                                          |
| Test     | Vitest (`ng test`), Postman collection (10 requests + test scripts) / Newman                                         |

## ฟีเจอร์

- เพิ่มงานพร้อม **หมวด (category) + วัน + เวลา** (`due_date`)
- สถานะ 3 ขั้น: `todo → doing → done` (ปุ่ม เริ่มทำ / พักไว้ก่อน / เสร็จแล้ว)
- **เกินเวลา (overdue)**: `due_date < ตอนนี้ AND ยังไม่ done` → ป้ายแดง + tab กรอง + `GET ?overdue=true`
- **ใกล้ถึงกำหนด (due soon, 24 ชม.)** → ป้ายเหลือง + tab กรอง + `GET ?due_soon=true`
- ค้นหา (กด `/`, `Esc` ล้าง), sort (ใกล้กำหนด/ใหม่/เก่า/งานค้างก่อน), pagination 10/หน้า
- Dark/Light mode, progress %, สถิติ ทั้งหมด/กำลังทำ/เกินเวลา/เสร็จ, responsive มือถือ+เว็บ

## โครงสร้าง

```
Todo-List-Application/
├── Todo-frontend/   # Angular app (port 4200)
│   └── src/app/     # app.ts/html/css, services/todo.service.ts, models/todo.model.ts
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

เช็ค: เปิด `http://localhost:3000/health` ต้องได้ `{"status":"ok"}` (server migrate table ให้เอง)

ค่า config อยู่ใน `.env` (`DATABASE_URL`, `PORT=3000`, `CORS_ORIGIN=http://localhost:4200`)

### API Endpoints

| Method | URL                                                                    | ใช้ทำอะไร                                       |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------------- |
| GET    | `/health`                                                              | เช็ค server                                     |
| GET    | `/api/todos`                                                           | ดึงทั้งหมด (+ `?status=&overdue=&due_soon=&q=`) |
| GET    | `/api/todos/:id`                                                       | ดึง 1 รายการ                                    |
| POST   | `/api/todos` `{title, category?, due_date?, status?}`                  | สร้าง (`201` + `{data}`)                        |
| PUT    | `/api/todos/:id` `{title?, category?, due_date?, status?, completed?}` | แก้ไข (`due_date: null` = ล้างกำหนด)            |
| PATCH  | `/api/todos/:id/status` `{status}`                                     | เปลี่ยนสถานะ todo/doing/done                    |
| PATCH  | `/api/todos/:id/toggle`                                                | สลับเสร็จ/ยังไม่เสร็จ (compat)                  |
| DELETE | `/api/todos/:id`                                                       | ลบ                                              |

ทุก response งานมี `overdue` + `due_soon` คำนวณให้ (`{data}`)

## 3) รัน Frontend

```powershell
cd Todo-frontend
npm install
ng serve
```

เปิด `http://localhost:4200/` ถ้า backend ดับจะขึ้นแถบแดง `ไม่สามารถโหลดรายการได้` แต่หน้าเว็บยังเปิดได้

### คำสั่งอื่น

```powershell
npm run build   # build production -> dist/
npm test        # unit test (Vitest, 2 passed)
```

## 4) ทดสอบ API ด้วย Postman

ไฟล์ test: `Todo-backend/postman/Todo-API.postman_collection.json`

1. เปิด Postman → Import → เลือกไฟล์ข้างบน
2. กด Runner รัน 10 ข้อตามลำดับ (ข้อ Create ส่ง `todoId` ต่อให้ข้ออื่นเอง มี assert `status/data` ทุกข้อ):
   `Health → List → Create (201) → Get one → PUT → Set status → Toggle → Overdue → Due soon → Delete`
3. แบบ CLI: `npx newman run Todo-backend/postman/Todo-API.postman_collection.json`

## หมายเหตุ

- Frontend ชี้ API ที่ `http://localhost:3000/api` (ดู `Todo-frontend/src/environments/environment.ts`)
- Created by [chaiwanlp](http://github.com/chaiwanlp)
