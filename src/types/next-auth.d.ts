import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
      status: string;
      schoolId: string | null;
      schoolName: string | null;
    };
  }
}
