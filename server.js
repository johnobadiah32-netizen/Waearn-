const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 3000;
const DB = "./database.json";

const ADMIN_PASSWORD = process.env.WA_ADMIN_PASSWORD || "ChangeThisAdmin123!";
const GROUP_LINK = process.env.WA_GROUP_LINK || "";

if (!fs.existsSync(DB)) {
  fs.writeFileSync(DB, JSON.stringify({
    users: [],
    tasks: [],
    claims: [],
    withdrawals: [],
    transactions: []
  }, null, 2));
}

function load() {
  return JSON.parse(fs.readFileSync(DB, "utf8"));
}

function save(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" }
}));

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please log in." });
  next();
}

function admin(req, res, next) {
  if (req.session.user !== "admin") return res.status(403).json({ error: "Admin only." });
  next();
}

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - WA EARN</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f0f5f2;font-family:Arial,sans-serif;color:#173c2b}
header{background:#075e36;color:white;padding:20px;text-align:center}
header h1{margin:0;font-size:29px}
nav{display:flex;justify-content:center;gap:16px;padding:13px;background:white;flex-wrap:wrap}
nav a{color:#08783f;text-decoration:none;font-weight:bold}
main{max-width:700px;margin:22px auto;padding:0 14px}
.card{background:white;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 3px 12px #0000000d}
h2{margin-top:0}
input,button{width:100%;padding:13px;border-radius:8px;margin:7px 0;border:1px solid #ccd8d0;font-size:16px}
button{background:#08783f;color:white;border:0;font-weight:bold;cursor:pointer}
button.secondary{background:#e5f3e9;color:#075e36}
a.join{display:block;background:#08783f;color:white;padding:13px;text-align:center;border-radius:8px;text-decoration:none;font-weight:bold}
small{color:#64776b}
.money{font-size:30px;font-weight:bold;color:#078044}
.item{padding:13px 0;border-bottom:1px solid #e7eee9}
.danger{background:#a83232}
</style>
</head>
<body>
<header><h1>💚 WA EARN</h1><p>Join WhatsApp groups. Complete tasks. Earn rewards.</p></header>
<nav>
<a href="/">Home</a><a href="/dashboard">Dashboard</a>
<a href="/tasks">Tasks</a><a href="/wallet">Wallet</a>
<a href="/logout">Logout</a>
</nav>
<main>${body}</main>
<script>
async function send(url,data){
 const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 const j=await r.json();
 alert(j.message||j.error||"Request completed");
 if(r.ok) location.reload();
}
</script>
</body></html>`;
}

app.get("/", (req,res) => {
res.send(page("Home", `
<div class="card">
<h2>Welcome to WA EARN</h2>
<p>Complete approved WhatsApp joining tasks and earn demo rewards.</p>
<a class="join" href="/register">Create Account</a>
<br><a class="join" href="/login">Login</a>
</div>
<div class="card"><h3>How it works</h3>
<p>1. Create your account.</p>
<p>2. Open an available WhatsApp group task.</p>
<p>3. Join the group and submit your claim.</p>
<p>4. Wait for admin verification.</p>
<p>5. Approved rewards enter your demo wallet.</p>
</div>
`));
});

app.get("/register",(req,res)=>{
res.send(page("Register",`
<div class="card"><h2>Create account</h2>
<form method="POST" action="/register">
<input name="username" placeholder="Username" required minlength="3">
<input name="email" type="email" placeholder="Email address" required>
<input name="password" type="password" placeholder="Password (8 characters minimum)" required minlength="8">
<button>Create Account</button></form></div>`));
});

app.post("/register",async(req,res)=>{
const {username,email,password}=req.body;
if(!username||!email||!password||password.length<8)
return res.status(400).send("Invalid registration details.");
const db=load();
if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase()||u.email===email))
return res.status(400).send("Username or email already exists.");
const user={
username:username.trim(),
email:email.trim().toLowerCase(),
password:await bcrypt.hash(password,12),
balance:0,
referral:crypto.randomBytes(4).toString("hex"),
joinedAt:new Date().toISOString()
};
db.users.push(user);
save(db);
req.session.user=user.username;
res.redirect("/dashboard");
});

app.get("/login",(req,res)=>{
res.send(page("Login",`
<div class="card"><h2>Login</h2>
<form method="POST" action="/login">
<input name="username" placeholder="Username" required>
<input name="password" type="password" placeholder="Password" required>
<button>Login</button></form></div>`));
});

app.post("/login",async(req,res)=>{
const db=load();
const user=db.users.find(u=>u.username===req.body.username);
if(!user||!await bcrypt.compare(req.body.password,user.password))
return res.status(401).send("Incorrect username or password.");
req.session.user=user.username;
res.redirect("/dashboard");
});

app.get("/logout",(req,res)=>req.session.destroy(()=>res.redirect("/")));

app.get("/dashboard",auth,(req,res)=>{
const db=load();
const user=db.users.find(u=>u.username===req.session.user);
if(!user)return res.redirect("/logout");
const claims=db.claims.filter(c=>c.username===user.username);
res.send(page("Dashboard",`
<div class="card"><h2>Hello, ${user.username.replace(/[<>&"]/g,"")}</h2>
<p>Your demo wallet balance</p><div class="money">₦${user.balance.toLocaleString()}</div>
<p>Referral code: <b>${user.referral}</b></p>
<p><small>Referral tracking is a demo feature.</small></p>
</div>
<div class="card"><h3>Your task claims</h3>
${claims.map(c=>`<div class="item">${c.taskName} — ${c.status}</div>`).join("")||"No claims yet."}
</div>
`));
});

app.get("/tasks",auth,(req,res)=>{
const db=load();
res.send(page("Tasks",`
<div class="card"><h2>WhatsApp tasks</h2>
${db.tasks.filter(t=>t.active).map(t=>`
<div class="item"><h3>${t.name}</h3>
<p>Reward: ₦${t.reward}</p>
<a class="join" href="${t.link}" target="_blank" rel="noopener">Join WhatsApp group</a>
<button onclick="send('/api/claim',{taskId:'${t.id}'})">I have joined — submit for review</button>
</div>`).join("")||"No tasks are available yet. Please check later."}
</div>`));
});

app.get("/wallet",auth,(req,res)=>{
const db=load();
const user=db.users.find(u=>u.username===req.session.user);
const transactions=db.transactions.filter(t=>t.username===user.username);
const withdrawals=db.withdrawals.filter(w=>w.username===user.username);
res.send(page("Wallet",`
<div class="card"><h2>My wallet</h2>
<div class="money">₦${user.balance.toLocaleString()}</div>
<small>Demo balance only. This is not withdrawable real money.</small>
</div>
<div class="card"><h3>Request withdrawal</h3>
<form method="POST" action="/withdraw">
<input name="amount" type="number" min="100" placeholder="Amount in naira" required>
<input name="bank" placeholder="Bank name" required>
<input name="account" placeholder="Account number" required maxlength="10">
<button>Submit request</button></form>
</div>
<div class="card"><h3>Transactions</h3>
${transactions.map(t=>`<div class="item">${t.description}: ₦${t.amount}</div>`).join("")||"No transactions yet."}
<h3>Withdrawal requests</h3>
${withdrawals.map(w=>`<div class="item">₦${w.amount} — ${w.status}</div>`).join("")||"No requests yet."}
</div>`));
});

app.post("/api/claim",auth,(req,res)=>{
const db=load();
const task=db.tasks.find(t=>t.id===req.body.taskId&&t.active);
if(!task)return res.status(404).json({error:"Task not found."});
if(db.claims.some(c=>c.taskId===task.id&&c.username===req.session.user))
return res.status(400).json({error:"You already submitted this task."});
db.claims.push({
id:crypto.randomUUID(),
taskId:task.id,
taskName:task.name,
username:req.session.user,
reward:task.reward,
status:"Pending",
date:new Date().toISOString()
});
save(db);
res.json({message:"Claim submitted. Wait for admin verification."});
});

app.post("/withdraw",auth,(req,res)=>{
const db=load();
const amount=Number(req.body.amount);
if(!Number.isInteger(amount)||amount<100)
return res.status(400).send("Minimum request is ₦100.");
const user=db.users.find(u=>u.username===req.session.user);
if(amount>user.balance)return res.status(400).send("Insufficient demo balance.");
db.withdrawals.push({
id:crypto.randomUUID(),
username:user.username,
amount,
bank:req.body.bank,
account:req.body.account,
status:"Pending",
date:new Date().toISOString()
});
save(db);
res.redirect("/wallet");
});

app.get("/admin",(req,res)=>{
if(req.session.user!=="admin")return res.redirect("/admin-login");
const db=load();
res.send(page("Admin",`
<div class="card"><h2>Admin dashboard</h2>
<h3>Add WhatsApp task</h3>
<form method="POST" action="/admin/task">
<input name="name" placeholder="Task name" required>
<input name="link" placeholder="WhatsApp invite link" required>
<input name="reward" type="number" min="1" placeholder="Reward in naira" required>
<button>Add task</button></form>
</div>
<div class="card"><h3>Pending claims</h3>
${db.claims.filter(c=>c.status==="Pending").map(c=>`
<div class="item">${c.username} — ${c.taskName} — ₦${c.reward}
<form method="POST" action="/admin/claim/${c.id}">
<button name="decision" value="approve">Approve and credit</button>
<button class="danger" name="decision" value="reject">Reject</button>
</form></div>`).join("")||"No pending claims."}
</div>
<div class="card"><h3>Withdrawal requests</h3>
${db.withdrawals.filter(w=>w.status==="Pending").map(w=>`
<div class="item">${w.username}: ₦${w.amount}<br>${w.bank} / ${w.account}
<form method="POST" action="/admin/withdraw/${w.id}">
<button name="decision" value="approve">Mark paid</button>
<button class="danger" name="decision" value="reject">Reject</button>
</form></div>`).join("")||"No pending withdrawals."}
</div>
`));
});

app.get("/admin-login",(req,res)=>{
res.send(page("Admin login",`
<div class="card"><h2>Admin login</h2>
<form method="POST" action="/admin-login">
<input name="password" type="password" placeholder="Admin password" required>
<button>Login as admin</button></form></div>`));
});

app.post("/admin-login",(req,res)=>{
if(req.body.password!==ADMIN_PASSWORD)
return res.status(401).send("Incorrect admin password.");
req.session.user="admin";
res.redirect("/admin");
});

app.post("/admin/task",admin,(req,res)=>{
const {name,link}=req.body;
const reward=Number(req.body.reward);
if(!name||!link||!link.startsWith("https://chat.whatsapp.com/")||!Number.isInteger(reward)||reward<1)
return res.status(400).send("Enter a valid WhatsApp invite link and reward.");
const db=load();
db.tasks.push({
id:crypto.randomUUID(),
name,
link,
reward,
active:true
});
save(db);
res.redirect("/admin");
});

app.post("/admin/claim/:id",admin,(req,res)=>{
const db=load();
const claim=db.claims.find(c=>c.id===req.params.id);
if(!claim||claim.status!=="Pending")return res.status(400).send("Claim unavailable.");
if(req.body.decision==="approve"){
const user=db.users.find(u=>u.username===claim.username);
if(!user)return res.status(404).send("User not found.");
user.balance+=claim.reward;
claim.status="Approved";
db.transactions.push({
username:user.username,
amount:claim.reward,
description:"Approved WhatsApp task",
date:new Date().toISOString()
});
}else claim.status="Rejected";
save(db);
res.redirect("/admin");
});

app.post("/admin/withdraw/:id",admin,(req,res)=>{
const db=load();
const w=db.withdrawals.find(x=>x.id===req.params.id);
if(!w||w.status!=="Pending")return res.status(400).send("Request unavailable.");
const user=db.users.find(u=>u.username===w.username);
if(req.body.decision==="approve"){
if(user.balance<w.amount)return res.status(400).send("Insufficient balance.");
user.balance-=w.amount;
w.status="Marked paid by admin";
db.transactions.push({username:user.username,amount:-w.amount,description:"Withdrawal",date:new Date().toISOString()});
}else w.status="Rejected";
save(db);
res.redirect("/admin");
});

app.listen(PORT,"0.0.0.0",()=>{
console.log("WA EARN is running on port "+PORT);
console.log("Open Chrome at http://127.0.0.1:"+PORT);
console.log("Admin login: http://127.0.0.1:"+PORT+"/admin-login");
console.log("Set WA_ADMIN_PASSWORD before using the admin account.");
});
