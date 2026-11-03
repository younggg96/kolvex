import { useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { benchmarks, symbols } from "../../lib/models";
import { Copy, Glass, NavRow, Page, Section } from "../../components/UI";
import { QuoteRow } from "../../components/Quotes";
export default function Markets() {
  const [revision, setRevision] = useState(0);
  return (
    <Page
      title="行情"
      subtitle="市场脉搏，尽在掌心。"
      onRefresh={() => setRevision((v) => v + 1)}
    >
      <Glass>
        <NavRow
          title="市场全景：指数 / 板块 / 风格 / 跨资产"
          onPress={() => router.push("/markets")}
        />
        <NavRow title="宏观指标" onPress={() => router.push("/macro")} />
        <NavRow
          title="市场日历"
          last
          onPress={() => router.push("/calendar")}
        />
      </Glass>
      <Section title="大盘速览" note="美国市场 · ETF 基准 · USD" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ gap: 12 }}
      >
        {benchmarks.map((symbol) => (
          <QuoteRow key={symbol} symbol={symbol} revision={revision} compact />
        ))}
      </ScrollView>
      <Section title="市场观察" note="报价来自数据源，可能存在延迟" />
      <View style={{ gap: 8 }}>
        {symbols.map((symbol) => (
          <QuoteRow key={symbol} symbol={symbol} revision={revision} />
        ))}
      </View>
      <Copy size={12} muted>
        研究从事实开始。市场数据与创作者观点不构成投资建议。
      </Copy>
    </Page>
  );
}
