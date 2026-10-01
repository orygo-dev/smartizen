"""TEST: RT head UMKM featured flow + cross-RT 403. Cleans up after itself."""
import os, random, requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0] + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
H = lambda t: {"Authorization": f"Bearer {t}"}
made = []


def user(name):
    phone = "0819" + str(random.randint(10000000, 99999999))
    r = requests.post(f"{BASE}/auth/register", json={"phone": phone, "password": "Secret#2026", "full_name": name}).json()
    t = r["access_token"]
    requests.post(f"{BASE}/auth/verify-otp", json={"phone": phone, "code": r.get("dev_otp")}, headers=H(t))
    made.append(phone)
    return t


admin = requests.post(f"{BASE}/auth/login", json={"identifier": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]}).json()["access_token"]
rws = {r["parent_id"]: r for r in db.regions.find({"level": "RW", "name": "RW 001"})}
villages = {v["id"]: v["name"] for v in db.regions.find({"level": "VILLAGE"})}
rw_a, rw_b = [r for r in rws.values()][:2]
rt_num = str(random.randint(100, 899))
heads, rts = [], []
for rw in (rw_a, rw_b):
    t = user("TEST Ketua")
    a = requests.post(f"{BASE}/rt/applications", headers=H(t), json={"rw_id": rw["id"], "rt_number": rt_num, "official": {"name": "TEST Ketua"}}).json()
    requests.post(f"{BASE}/rt/applications/{a['application']['id']}/verify", headers=H(admin)).raise_for_status()
    heads.append(t); rts.append(a["application"]["rt_id"])
res = user("TEST Warga A")
requests.post(f"{BASE}/residents/membership", headers=H(res), json={"rt_id": rts[0]}).raise_for_status()
m = requests.post(f"{BASE}/marketplace/merchants", headers=H(res), json={"name": "TEST Warung A", "category": "Makanan"}).json()
print("merchant region ok:", m["region_id"] == rts[0])
r = requests.get(f"{BASE}/umkm/manage", headers=H(heads[0])).json()
print("manage A lists merchant:", any(x["id"] == m["id"] for x in r["merchants"]), r["rt"]["id"] == rts[0])
print("manage B for RT A ->", requests.get(f"{BASE}/umkm/manage", headers=H(heads[1]), params={"rt_id": rts[0]}).status_code)
print("feature by B ->", requests.post(f"{BASE}/umkm/featured", headers=H(heads[1]), json={"merchant_id": m["id"]}).status_code)
print("feature by resident ->", requests.post(f"{BASE}/umkm/featured", headers=H(res), json={"merchant_id": m["id"]}).status_code)
print("feature by A ->", requests.post(f"{BASE}/umkm/featured", headers=H(heads[0]), json={"merchant_id": m["id"], "note": "Promo"}).status_code)
n = requests.get(f"{BASE}/umkm/nearby", headers=H(res)).json()
print("nearby featured:", [f["name"] for f in n["featured"]], "note:", n["featured"][0]["featured_note"] if n["featured"] else None)
print("clear by B ->", requests.delete(f"{BASE}/umkm/featured/{rts[0]}", headers=H(heads[1])).status_code)
print("clear by A ->", requests.delete(f"{BASE}/umkm/featured/{rts[0]}", headers=H(heads[0])).status_code)

# cleanup
uids = [str(u["_id"]) for u in db.users.find({"phone": {"$in": made}})]
for c, f in [("role_assignments", "user_id"), ("memberships", "user_id"), ("persons", "user_id"), ("social_profiles", "user_id"),
             ("notifications", "user_id"), ("merchants", "owner_user_id"), ("rt_applications", "applicant_user_id"), ("sessions", "user_id")]:
    db[c].delete_many({f: {"$in": uids}})
db.umkm_featured.delete_many({"rt_id": {"$in": rts}})
db.audit_logs.delete_many({"actor_id": {"$in": uids}})
db.regions.delete_many({"id": {"$in": rts}, "rt_number": rt_num})
db.users.delete_many({"phone": {"$in": made}})
print("cleaned", len(uids))
