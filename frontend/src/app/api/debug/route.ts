import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_FACTORY_ADDRESS,
    NEXT_PUBLIC_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_ROUTER_ADDRESS,
    NEXT_PUBLIC_TOKEN_A_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS,
    NEXT_PUBLIC_TOKEN_B_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS,
    NEXT_PUBLIC_TOKEN_C_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_C_ADDRESS,
  });
}
