import { randomUUID } from "node:crypto";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: path.resolve(".env.local") });

const requiredEnvironment = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Missing ${name}; database security verification cannot run.`);
  }
}

const prisma = new PrismaClient();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "course-materials";
const verificationId = randomUUID();
const objectName = `${verificationId}.txt`;
const objectPath = `security-verification/${objectName}`;
const email = `security-verification-${verificationId}@example.invalid`;
const password = `${randomUUID()}Aa1!`;

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonymous = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let authUserId;
let objectUploaded = false;

function expectStorageDenial(result, label) {
  if (!result.error) {
    throw new Error(`${label} unexpectedly succeeded.`);
  }
}

function expectObjectHidden(result, label) {
  if (!result.error && result.data?.some((item) => item.name === objectName)) {
    throw new Error(`${label} exposed the temporary object.`);
  }
}

try {
  const unprotectedTables = await prisma.$queryRaw`
    SELECT c.relname AS "tableName"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> '_prisma_migrations'
      AND c.relrowsecurity = false
    ORDER BY c.relname
  `;
  if (unprotectedTables.length > 0) {
    throw new Error(`Public tables without RLS: ${unprotectedTables.map((row) => row.tableName).join(", ")}`);
  }

  const browserRoleGrants = await prisma.$queryRaw`
    SELECT table_name AS "tableName", grantee, privilege_type AS "privilegeType"
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name <> '_prisma_migrations'
      AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee, privilege_type
  `;
  if (browserRoleGrants.length > 0) {
    throw new Error("Supabase browser roles still have direct public-table privileges.");
  }

  const bucketResult = await service.storage.getBucket(bucket);
  if (bucketResult.error || !bucketResult.data) {
    throw new Error("The private material bucket is unavailable.");
  }
  if (bucketResult.data.public) {
    throw new Error("The material bucket is public.");
  }

  const upload = await service.storage
    .from(bucket)
    .upload(objectPath, new TextEncoder().encode("BRAIL security verification"), {
      contentType: "text/plain",
      upsert: false,
    });
  if (upload.error) {
    throw new Error("Could not create the temporary storage verification object.");
  }
  objectUploaded = true;

  expectObjectHidden(
    await anonymous.storage.from(bucket).list("security-verification"),
    "Anonymous bucket listing",
  );
  expectStorageDenial(
    await anonymous.storage.from(bucket).download(objectPath),
    "Anonymous object download",
  );

  const createdUser = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createdUser.error || !createdUser.data.user) {
    throw new Error("Could not create the temporary authenticated storage test user.");
  }
  authUserId = createdUser.data.user.id;

  const authenticated = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await authenticated.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    throw new Error("Could not sign in the temporary storage test user.");
  }

  expectObjectHidden(
    await authenticated.storage.from(bucket).list("security-verification"),
    "Authenticated bucket listing",
  );
  expectStorageDenial(
    await authenticated.storage.from(bucket).download(objectPath),
    "Authenticated object download",
  );

  console.log("Database security verification passed:");
  console.log(`- ${unprotectedTables.length} public app tables without RLS`);
  console.log(`- ${browserRoleGrants.length} direct browser-role table grants`);
  console.log("- private material bucket rejects anonymous and authenticated listing/download");
} finally {
  if (objectUploaded) {
    await service.storage.from(bucket).remove([objectPath]);
  }
  if (authUserId) {
    await service.auth.admin.deleteUser(authUserId);
  }
  await prisma.$disconnect();
}
