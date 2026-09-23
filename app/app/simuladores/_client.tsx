"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowSquareOut, Calculator, Info } from "@/lib/ui/icons";

const BCB_URL =
  "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirFormFinanciamentoPrestacoesFixas.do?method=exibirFormFinanciamentoPrestacoesFixas";

const PRODUTOS = ["CLT", "Caixa", "BRB", "Inter"] as const;

function numero(valor: string): number {
  return Number(valor.trim().replace(/\./g, "").replace(",", "."));
}

function dinheiro(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export function calcularPrestacao(valor: number, meses: number, taxaMensal: number): number {
  if (!Number.isFinite(valor) || valor <= 0 || !Number.isInteger(meses) || meses <= 0) return 0;
  if (!Number.isFinite(taxaMensal) || taxaMensal < 0) return 0;
  const taxa = taxaMensal / 100;
  if (taxa === 0) return valor / meses;
  return (valor * taxa) / (1 - Math.pow(1 + taxa, -meses));
}

function ProdutoEmConfiguracao({ nome }: { nome: (typeof PRODUTOS)[number] }) {
  return (
    <Card className="mt-4 border-dashed">
      <CardHeader>
        <CardTitle>Simulador {nome}</CardTitle>
        <CardDescription>
          Estrutura preparada para receber os coeficientes, convênios e regras comerciais da Zion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm text-text-muted">
          <Info className="mt-0.5 size-5 shrink-0 text-accent-500" aria-hidden="true" />
          <p>
            Esta opção será liberada depois da configuração das tabelas oficiais do banco. Assim,
            nenhum vendedor apresenta ao cliente uma taxa ou valor incorreto.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SimuladorCidadao() {
  const [valor, setValor] = React.useState("");
  const [meses, setMeses] = React.useState("");
  const [taxa, setTaxa] = React.useState("");

  const resultado = React.useMemo(() => {
    const principal = numero(valor);
    const prazo = Number(meses);
    const juros = numero(taxa);
    const prestacao = calcularPrestacao(principal, prazo, juros);
    if (prestacao <= 0) return null;
    return { prestacao, total: prestacao * prazo, juros: prestacao * prazo - principal };
  }, [meses, taxa, valor]);

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Financiamento com prestações fixas</CardTitle>
          <CardDescription>
            Estimativa pelo sistema Price. Preencha valor, prazo e taxa mensal para calcular a parcela.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="valor-financiado">Valor financiado</Label>
              <Input
                id="valor-financiado"
                inputMode="decimal"
                placeholder="Ex.: 20.000,00"
                value={valor}
                onChange={(event) => setValor(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo-meses">Prazo em meses</Label>
              <Input
                id="prazo-meses"
                inputMode="numeric"
                placeholder="Ex.: 48"
                value={meses}
                onChange={(event) => setMeses(event.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxa-mensal">Taxa mensal (%)</Label>
              <Input
                id="taxa-mensal"
                inputMode="decimal"
                placeholder="Ex.: 1,49"
                value={taxa}
                onChange={(event) => setTaxa(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase text-text-muted">Prestação estimada</p>
              <p className="mt-1 text-2xl font-semibold text-text">
                {resultado ? dinheiro(resultado.prestacao) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-text-muted">Total das prestações</p>
              <p className="mt-1 text-lg font-semibold text-text">
                {resultado ? dinheiro(resultado.total) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-text-muted">Juros estimados</p>
              <p className="mt-1 text-lg font-semibold text-text">
                {resultado ? dinheiro(resultado.juros) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calculadora oficial</CardTitle>
          <CardDescription>
            Confira a simulação diretamente no serviço público do Banco Central do Brasil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-text-muted">
            A estimativa não representa proposta de crédito. Taxas, seguros, tributos e condições finais
            dependem da instituição financeira.
          </p>
          <Button asChild className="w-full">
            <a href={BCB_URL} target="_blank" rel="noopener noreferrer">
              Abrir Simulador Cidadão
              <ArrowSquareOut className="ml-2 size-4" aria-hidden="true" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function SimuladoresClient() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-accent-500/30 bg-accent-soft text-accent-500">
          <Calculator className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-text">Simuladores</h1>
          <p className="mt-1 text-sm text-text-muted">
            Apoio rápido para cálculos financeiros durante o atendimento.
          </p>
        </div>
      </header>

      <Tabs defaultValue="cidadao">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="cidadao">Cidadão</TabsTrigger>
          {PRODUTOS.map((produto) => (
            <TabsTrigger key={produto} value={produto.toLowerCase()}>
              {produto}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="cidadao">
          <SimuladorCidadao />
        </TabsContent>
        {PRODUTOS.map((produto) => (
          <TabsContent key={produto} value={produto.toLowerCase()}>
            <ProdutoEmConfiguracao nome={produto} />
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
