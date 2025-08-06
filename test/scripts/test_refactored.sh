#!/bin/bash
# Test Script for Phase IV Refactored Implementation
# File: test_refactored.sh

echo "🎮 Agentic Frontier - Phase IV Refactored Test"
echo "=============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Testing what DOES work:${NC}"
echo ""

# Test 1: File tracking
echo -e "${YELLOW}Test 1: File Operation Tracking${NC}"
cat > test_hook_write.json << 'EOF'
{
  "session_id": "test-session-001",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/src/components/TestComponent.js",
    "content": "export default function TestComponent() {\n  return <div>Test</div>;\n}"
  }
}
EOF

echo "Sending Write hook..."
curl -X POST http://localhost:3001/api/webhooks/claude/PostToolUse \
  -H "Content-Type: application/json" \
  -d @test_hook_write.json \
  --silent | jq '.'

echo -e "${GREEN}✓ File should appear as settlement${NC}"
echo ""

# Test 2: Edit tracking (without full content)
echo -e "${YELLOW}Test 2: Edit Operation (Limited Content)${NC}"
cat > test_hook_edit.json << 'EOF'
{
  "session_id": "test-session-001",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/src/components/TestComponent.js",
    "old_str": "return <div>Test</div>",
    "new_str": "return <div>Updated Test</div>"
  }
}
EOF

echo "Sending Edit hook..."
curl -X POST http://localhost:3001/api/webhooks/claude/PostToolUse \
  -H "Content-Type: application/json" \
  -d @test_hook_edit.json \
  --silent | jq '.'

echo -e "${GREEN}✓ File marked as needs_parsing${NC}"
echo ""

# Test 3: Check file status
echo -e "${YELLOW}Test 3: File Parsing Status${NC}"
echo "Checking file status in database..."
curl -X GET http://localhost:3001/api/files/1 --silent | jq '.files[] | {file_name, parsing_status}'
echo ""

# Test 4: Structure endpoint (should be empty)
echo -e "${YELLOW}Test 4: Structure Query (Expected Empty)${NC}"
echo "Querying structures (should show pending message)..."
curl -X GET http://localhost:3001/api/structures/1 --silent | jq '.'
echo ""

echo -e "${BLUE}Testing what DOESN'T work yet:${NC}"
echo ""

# Test 5: Dependency tracking
echo -e "${RED}Test 5: Dependency Tracking${NC}"
echo "Dependencies require full file content to parse imports"
curl -X GET http://localhost:3001/api/dependencies/1 --silent | jq '.'
echo -e "${YELLOW}⚠️  Limited until we can parse import statements${NC}"
echo ""

# Test 6: TreeSitter endpoint
echo -e "${RED}Test 6: TreeSitter Update Endpoint${NC}"
echo "Testing future TreeSitter endpoint..."
cat > test_treesitter.json << 'EOF'
{
  "file_path": "/src/test.js",
  "structures": [
    {
      "name": "TestClass",
      "type": "class",
      "start_line": 1,
      "end_line": 10
    }
  ],
  "session_id": "test-001"
}
EOF

curl -X POST http://localhost:3001/api/structures/update \
  -H "Content-Type: application/json" \
  -d @test_treesitter.json \
  --silent | jq '.'
echo -e "${YELLOW}⚠️  TreeSitter integration pending${NC}"
echo ""

# Test 7: Dashboard capabilities
echo -e "${BLUE}Test 7: System Capabilities${NC}"
echo "Checking current system capabilities..."
curl -X GET http://localhost:3001/api/dashboard --silent | jq '.capabilities'
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Test Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "✅ Working Features:"
echo "  • File tracking and positioning"
echo "  • Settlement visualization"
echo "  • Agent movement to files"
echo "  • Activity event logging"
echo "  • SSE real-time updates"
echo ""
echo "⏳ Pending Features (need content access):"
echo "  • Code structure parsing (except new files)"
echo "  • Method/class visualization"
echo "  • Dependency tracking"
echo "  • Call graph analysis"
echo "  • Granular agent positioning"
echo ""
echo "🔮 Future Integration Points:"
echo "  • TreeSitter hook enhancement"
echo "  • GitHub repository integration"
echo "  • Local file system bridge"
echo "  • Runtime analysis tools"
echo ""

# Clean up
rm -f test_hook_write.json test_hook_edit.json test_treesitter.json

echo "Test complete!"