#!/bin/bash

# 下载功能测试脚本
# 用法: ./test-download.sh

set -e

BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api"

echo "🧪 测试电路设计下载功能"
echo "================================"
echo ""

# 测试数据：简单的电阻电路
CIRCUIT_JSON='[
  {
    "type": "source_component",
    "source_component_id": "simple_resistor",
    "ftype": "simple_resistor",
    "resistance": "1k"
  }
]'

CODE='import { Resistor } from "@tscircuit/core"
const circuit = new Circuit()
circuit.add(
  <board width="10mm" height="10mm">
    <Resistor resistance="1k" footprint="0805" />
  </board>
)
export default circuit'

echo "📋 测试数据准备完成"
echo ""

# 测试 1: 下载 KiCad PCB 文件
echo "1️⃣ 测试下载 KiCad PCB 文件..."
HTTP_CODE=$(curl -s -o kicad_test.kicad_pcb -