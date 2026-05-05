import { createEntityClient, base44 } from "../api/base44Client";
const client = createEntityClient("Student");

export const User = {
  ...client,
  updateMyUserData: async (data) => {
    try {
      const me = await base44.auth.me();
      // Ensure we only send fields that exist in the Base44 schema
      if (me && me.id) {
        // Get full student data first to avoid 422 errors
        const studentList = await client.list();
        const studentData = studentList.find(s => s.id === me.id);
        
        if (studentData) {
          const updatePayload = {
            ...studentData,
            role: data.role,
            student_id: data.student_id,
            verification_status: data.verification_status,
            last_login: data.last_login
          };
          console.log('[USER] Updating student data:', updatePayload);
          return await client.update(me.id, updatePayload);
        }
      }
    } catch (error) {
      console.warn("[USER] Could not sync user data:", error);
      // Don't throw - this is non-critical
    }
  }
};