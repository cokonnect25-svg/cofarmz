import bcrypt from 'bcrypt';
import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Hash the demo password
    const hashedPassword = await bcrypt.hash('demo1234', 12);

    // Update the demo user with the hashed password
    await sql`
      UPDATE "user" 
      SET password = ${hashedPassword} 
      WHERE email = 'demo@appgen.com'
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Demo user password set successfully' 
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup demo user' },
      { status: 500 }
    );
  }
}
