#!/bin/bash
# t402 Demo: Shows the 402 payment challenge-response flow
# Run while backend is running: bun dev

BASE_URL="${API_URL:-http://localhost:3700}"

echo "=== t402 Payment Protocol Demo ==="
echo ""

echo "1. Call verification API without payment..."
echo "   curl -s -X POST $BASE_URL/t402/verify"
echo ""
curl -s -X POST "$BASE_URL/t402/verify" | python3 -m json.tool 2>/dev/null
echo ""

echo "2. Call with payment signature (simulated)..."
echo "   curl -s -X POST -H 'payment-signature: demo_sig' $BASE_URL/t402/verify"
echo ""
curl -s -X POST -H "payment-signature: demo_payment_sig_0x1234" "$BASE_URL/t402/verify" | python3 -m json.tool 2>/dev/null
echo ""

echo "3. Query reputation (402 challenge)..."
curl -s "$BASE_URL/t402/reputation/0x51131e5b1289116342279698417f8652fD7520F8" | python3 -m json.tool 2>/dev/null
echo ""

echo "4. List all paywalled endpoints..."
curl -s "$BASE_URL/t402/endpoints" | python3 -m json.tool 2>/dev/null | head -20
echo ""
echo "=== Done ==="
