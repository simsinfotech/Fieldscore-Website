import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify admin
  const { data: emp } = await supabase
    .from("fs_employees")
    .select("is_admin")
    .eq("auth_id", user.id)
    .single()

  if (!emp?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { payroll_id, amount } = await req.json()

  if (!payroll_id || !amount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  try {
    // Create Razorpay order
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        receipt: payroll_id,
      }),
    })

    const order = await res.json()

    if (order.error) {
      return NextResponse.json({ error: order.error.description }, { status: 400 })
    }

    // Update payroll record
    await supabase
      .from("fs_payroll")
      .update({
        razorpay_order_id: order.id,
        status: "pending",
      })
      .eq("id", payroll_id)

    return NextResponse.json({ order_id: order.id, amount: order.amount })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
