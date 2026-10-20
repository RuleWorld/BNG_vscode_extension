# BNGL Grammar Reference

Derived from the BioNetGen source code (`bng2/Perl2/`). This document is maintained alongside the VS Code extension's parser (`src/server/parser.ts`).

Comments begin with `#` and continue to end of line. Line continuation is `\` as the last non-whitespace character.

---

## Model Structure

```
Model = [{Option}],
        ( {Block}
        | "begin model", {Block}, "end model"
        ),
        [{Action}] ;
```

Actions may appear inside a `begin actions`/`end actions` block or bare at the top level (after `end model` or after all blocks).

## Block Types

| Block | Begin/End | Aliases |
|---|---|---|
| `parameters` | `begin parameters` ... `end parameters` | |
| `molecule types` | `begin molecule types` ... `end molecule types` | `molecules` |
| `seed species` | `begin seed species` ... `end seed species` | `species` |
| `compartments` | `begin compartments` ... `end compartments` | |
| `observables` | `begin observables` ... `end observables` | |
| `functions` | `begin functions` ... `end functions` | |
| `energy patterns` | `begin energy patterns` ... `end energy patterns` | |
| `reaction rules` | `begin reaction rules` ... `end reaction rules` | `rules` |
| `actions` | `begin actions` ... `end actions` | |
| `protocol` | `begin protocol` ... `end protocol` | |
| `population types` | `begin population types` ... `end population types` | |
| `population maps` | `begin population maps` ... `end population maps` | |
| `reactions` | `begin reactions` ... `end reactions` | (`.net` files) |
| `groups` | `begin groups` ... `end groups` | (`.net` files) |
| `model` | `begin model` ... `end model` | (wrapper) |

## Identifiers and Primitives

```
Name       = Letter , [{Letter | Digit | "_"}] ;
State      = "~", (Letter | Digit), [{Letter | Digit | "_"}]  |  "~?" ;
Bond       = "!", {Digit}  |  "!?"  |  "!+" ;
Tag        = "%", Name ;
Compartment = "@", Name ;
LineLabel  = {Digit}, WS  |  Name, ":", [WS] ;
```

## Molecule Types

```
ComponentType = Name, [{"~", State}] ;
MoleculeType  = Name, ["(", [ComponentType, [{",", ComponentType}]], ")"] ;
```

Examples: `A()`, `Rec(l,d~Y~pY)`, `Kinase(s~u~p,b)`

## Molecules and Patterns

```
Component = Name, [{"~", State | "!", Bond | "%", Tag}] ;
Molecule  = Name, [{Tag | Compartment}], ["(", [Component, [{",", Component}]], ")"] ;
Pattern   = "0"
          | [{Tag | Compartment}, (":" | "::")],
            [PatternMods], Molecule, [{".", Molecule}], [PatternQuantifier] ;

PatternMods      = {"$" | "{matchOnce}"} ;
PatternQuantifier = ("<" | "<=" | "==" | ">=" | ">"), NaturalNumber ;
```

## Parameters

```
ParameterDefn = Name, (WS | "="), MathExpression ;
```

Examples: `k1 1.0`, `NA = 6.02e23`, `k_on 2*base_rate`

## Compartments

```
CompartmentDefn = Name, WS, ("2" | "3"), WS, MathExpression, [WS, Name] ;
```

The fields are: name, spatial dimensions (2=surface, 3=volume), size expression, optional outside compartment.

Example: `PM  2  sa_PM  EC`

## Observables

```
Observable = ("Molecules" | "Species" | "Counter"), WS, Name, WS, Pattern, [{",", Pattern}] ;
```

Examples: `Molecules Obs_A A()`, `Species Tot_AB A(), B()`

## Functions

```
FunctionDefn = Name, ["(", [Name, [{",", Name}]], ")"], (WS | "="), MathExpression ;
```

Examples: `rate_A() = k1 * Obs_A / (Km + Obs_A)`, `total = Obs_A + Obs_B`

## Energy Patterns

```
EnergyPatternDefn = Pattern, WS, MathExpression ;
```

Example: `A(b!1).B(a!1)  -5.0`

## Reaction Rules

```
UniRule = [Label ":"] Pattern, [{"+" , Pattern}], "->", Pattern, [{"+" , Pattern}],
          WS, RateLaw, [{WS, RuleModifier}] ;
RevRule = [Label ":"] Pattern, [{"+" , Pattern}], "<->", Pattern, [{"+" , Pattern}],
          WS, RateLaw, ",", RateLaw, [{WS, RuleModifier}] ;

RuleModifier = "DeleteMolecules" | "MoveConnected" | "TotalRate"
             | "priority", "=", Integer
             | "exclude_reactants", "(", PositiveInteger, Pattern, [{",", Pattern}], ")"
             | "include_reactants", "(", PositiveInteger, Pattern, [{",", Pattern}], ")"
             | "exclude_products", "(", PositiveInteger, Pattern, [{",", Pattern}], ")"
             | "include_products", "(", PositiveInteger, Pattern, [{",", Pattern}], ")" ;
```

Examples:
```bngl
0 -> A()  k_syn
A() -> 0  k_deg  DeleteMolecules
_R1: A() + B() <-> C()  kf, kr
A(b) + B(a) -> A(b!1).B(a!1) kf exclude_reactants(1,A(b!+))
```

## Rate Laws

```
RateLaw = MathExpression
        | "Sat", "(", MathExpression, ",", MathExpression, ")"
        | "MM", "(", MathExpression, ",", MathExpression, ")"
        | "Hill", "(", MathExpression, ",", MathExpression, ",", MathExpression, ")"
        | "Arrhenius", "(", MathExpression, ",", MathExpression, ")"
        | "FunctionProduct", "(", MathExpression, ",", MathExpression, ")" ;
```

## Math Expressions

```
MathExpression = Real | Name | "(", MathExpression, ")"
               | UnaryOp, MathExpression
               | MathExpression, BinaryOp, MathExpression
               | Name, "(", [MathExpression, [{",", MathExpression}]], ")" ;
```

### Built-in Functions

| Function | Signature | Description |
|---|---|---|
| `sin`, `cos`, `tan` | `f(x)` | Trigonometric |
| `asin`, `acos`, `atan` | `f(x)` | Inverse trigonometric |
| `sinh`, `cosh`, `tanh` | `f(x)` | Hyperbolic |
| `asinh`, `acosh`, `atanh` | `f(x)` | Inverse hyperbolic |
| `exp` | `exp(x)` | Exponential |
| `ln` | `ln(x)` | Natural logarithm |
| `log2` | `log2(x)` | Base-2 logarithm |
| `log10` | `log10(x)` | Base-10 logarithm |
| `sqrt` | `sqrt(x)` | Square root |
| `abs` | `abs(x)` | Absolute value |
| `rint` | `rint(x)` | Round to nearest integer |
| `min`, `max` | `f(a, b)` | Minimum / maximum |
| `sum`, `avg` | `f(a, b, ...)` | Sum / average |
| `if` | `if(cond, true, false)` | Conditional |
| `mratio` | `mratio(a, b, c)` | Multi-state ratio |
| `time` | `time()` | Current simulation time |
| `tfun` | `tfun('file')` or `tfun([x],[y],idx)` | Table function (interpolation) |
| `TFUN` | `TFUN(obs, 'file')` | Legacy table function |

### Built-in Constants

| Name | Value |
|---|---|
| `_pi` | 3.14159... |
| `_e` | 2.71828... |

## Actions

```
Action = Name, "(", [Args], ")", [";"] ;
Args   = Real | String | "{", Name, "=>", Args, [{",", Name, "=>", Args}], "}"
       | "[", (Real | String), [{",", (Real | String)}], "]" ;
```

### Available Actions

| Action | Description |
|---|---|
| `simulate` | General simulation (`method=>"ode"\|"ssa"\|"nf"`) |
| `simulate_ode` | ODE simulation |
| `simulate_ssa` | Stochastic (Gillespie) simulation |
| `simulate_pla` | Partitioned-leaping simulation |
| `simulate_psa` | Partial propensity stochastic simulation |
| `simulate_nf` | Network-free (NFsim) simulation |
| `simulate_protocol` | Run simulation protocol |
| `generate_network` | Generate reaction network from rules |
| `generate_hybrid_model` | Generate hybrid particle/population model |
| `parameter_scan` | Scan a parameter range |
| `bifurcate` | Bifurcation analysis |
| `LinearParameterSensitivity` | Linear parameter sensitivity |
| `setParameter` | Set parameter value |
| `setConcentration` | Set species concentration |
| `addConcentration` | Add to species concentration |
| `saveParameters` | Cache current parameters |
| `resetParameters` | Restore cached parameters |
| `saveConcentrations` | Cache current concentrations |
| `resetConcentrations` | Restore cached concentrations |
| `writeSBML` | Export to SBML |
| `writeMexFile` | Export MEX file |
| `writeMfile` | Export MATLAB .m file |
| `writeNetwork` | Write .net file |
| `visualize` | Generate contact maps, rule visualizations |
| `readFile` | Read a BioNetGen file |
| `setOption` | Set model option |
| `quit` | Exit BioNetGen |
| `version` | Print version |

## Seed Species

```
SeedSpeciesDefn = ["$"], Species, WS, MathExpression ;
```

The optional `$` marks the species as having a fixed (clamped) concentration.

Example: `$A()  100`, `B(s~u)  0`

## Population Maps

```
PopulationMap = Species, "->", SimpleSpecies, WS, RateLaw, [{WS, RuleModifier}] ;
```
