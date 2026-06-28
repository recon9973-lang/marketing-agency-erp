import type { DefaultSession } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";
import type { Role } from "@/domain/types";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: Role;
      authProvider?: string;
      authProviderAccountId?: string;
    };
  }

  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: Role;
    authProvider?: string;
    authProviderAccountId?: string;
  }
}
