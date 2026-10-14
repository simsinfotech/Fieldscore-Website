import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payroll_id } =
    await req.json()

  // Verify signature
  const body = razorpay_order_id + "|" + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex")

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // Mark payroll as paid
  const { error } = await supabase
    .from("fs_payroll")
    .update({
      razorpay_payment_id,
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", payroll_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get payroll to notify employee
  const { data: payroll } = await supabase
    .from("fs_payroll")
    .select("employee_id, net_salary, month, year")
    .eq("id", payroll_id)
    .single()

  if (payroll) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    await supabase.from("fs_notifications").insert({
      recipient_id: payroll.employee_id,
      type: "payslip",
      title: "Salary Credited",
      message: `Your salary of ₹${Number(payroll.net_salary).toLocaleString("en-IN")} for ${months[payroll.month - 1]} ${payroll.year} has been processed.`,
      link: "/payroll",
    })
  }

  return NextResponse.json({ success: true })
}
