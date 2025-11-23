Perfecto. Con los ejemplos que compartiste, voy a darte **el plan detallado + el template concreto** para **Daily, Weekly, Monthly y Yearly** adaptado a Obsidian + Templater + Dataview, combinando **Bullet Journal + 5 Minute Journal**.

> 👉 Todo respetará tu estilo actual (frontmatter, navegación, estadísticas, cursor, etc.), solo añadiremos las secciones nuevas de 5MJ y el concepto de *meta del día / intención / reflexión positiva*.

---

# 🗓 DAILY — Bullet + 5MJ + Frase del día (API)

### 📌 Objetivo del template

* Mantiene navegación y metadatos que ya usas.
* Agrega:

  * **Gratitud (3)**
  * **Intención / Objetivo 5MJ**
  * **Mejorará el día (3)**
  * **Mejor del día (3)**
  * **Lección (1)**
  * **Frase motivacional desde API**

---

### 📄 daily.md (adaptado)

> 🔽 Solo copia/pega dentro de tu template diario (recomendado reemplazar el bloque Journaling)

```md
## Journaling

### 🌅 Morning

**🙏 Gratitude (3)**  
1. <% tp.file.cursor(11) %>  
2. <% tp.file.cursor(12) %>  
3. <% tp.file.cursor(13) %>

**🎯 Daily Intention (1) — *One main focus***
→ <% tp.file.cursor(14) %>

**✨ What will make today great? (3)**
1. <% tp.file.cursor(15) %>
2. <% tp.file.cursor(16) %>
3. <% tp.file.cursor(17) %>

### 🌟 Daily Quote
> <% tp.web.daily_quote() %>

---

### 🌙 Night

**💎 Best moments of the day (3)**
1. <% tp.file.cursor(18) %>
2. <% tp.file.cursor(19) %>
3. <% tp.file.cursor(20) %>

**📌 Lesson learned / How could it improve?**
→ <% tp.file.cursor(21) %>
```

---

# 📆 WEEKLY — Planificación + Revisión estilo 5MJ

### 📌 Objetivo del template semanal

* Mantener:

  * Tabla de objetivos diarios
  * Score semanal
  * Navegación automática
* Agregar:

  * **Gratitudes semanales**
  * **Mejores momentos**
  * **Aprendizajes**
  * **Intención principal de la semana**

---

### 📄 weekly.md (añadir debajo de `## Weekly introspection`)

```md
### 🧠 Weekly Reflection (5MJ-style)

**🙏 Weekly Gratitude (5)**
1. <% tp.file.cursor(7) %>
2. <% tp.file.cursor(8) %>
3. <% tp.file.cursor(9) %>
4. <% tp.file.cursor(10) %>
5. <% tp.file.cursor(11) %>

**🌟 Highlights / Best Moments (3)**
1. <% tp.file.cursor(12) %>
2. <% tp.file.cursor(13) %>
3. <% tp.file.cursor(14) %>

**📌 Weekly Lesson (1)**
→ <% tp.file.cursor(15) %>

**🛠 To Improve Next Week**
→ <% tp.file.cursor(16) %>
```

---

# 🏷 MONTHLY — Bullet + KPIs + Gratitud + Reflexión Profunda

### 📌 Qué se añade:

* **Gratitudes grandes (5)**
* **Logros grandes (5)**
* **KPIs de bienestar mensuales**
* **Lección mensual**
* **Ajuste para el próximo mes**

---

### 📄 monthly.md (añadir debajo de `### Inner introspection`)

```md
### 🌼 Monthly Gratitude (5)
1. <% tp.file.cursor(20) %>
2. <% tp.file.cursor(21) %>
3. <% tp.file.cursor(22) %>
4. <% tp.file.cursor(23) %>
5. <% tp.file.cursor(24) %>

### 🏆 Big Wins of the Month (5)
1. <% tp.file.cursor(25) %>
2. <% tp.file.cursor(26) %>
3. <% tp.file.cursor(27) %>
4. <% tp.file.cursor(28) %>
5. <% tp.file.cursor(29) %>

### 📊 KPIs of Well-being
- 🧠 Mindset: `/10`  
- 💤 Energy: `/10`  
- 🤝 Relationships: `/10`
- 💰 Finances: `/10`  
- 📚 Progress / Learning: `/10`  

### 🧠 Monthly Lesson
→ <% tp.file.cursor(30) %>

### 🔧 Adjustments for Next Month
→ <% tp.file.cursor(31) %>
```

---

# 🌍 YEARLY — Visión + Objetivos SMART + Hábitos Macro + 5MJ profundo

### 📄 yearly.md (nuevo archivo estilo template)

```md
---
tags: annual, calendar
year: <% moment().format("YYYY") %>
---

# 📆 <% moment().format("YYYY") %>

## 🎯 Word / Concept of the Year
→ <% tp.file.cursor(1) %>

## 🌟 Vision Statement
→ <% tp.file.cursor(2) %>

## 🔥 Annual SMART Goals
| Area | Goal | Metric |
|------|------|--------|
| Health | | |
| Finances | | |
| Learning | | |
| Relationships | | |
| Passion Project | | |
| Mental/Spiritual | | |

## 📊 Habit Board (Macro)
| Habit | Q1 | Q2 | Q3 | Q4 |
|-------|----|----|----|----|
|  |  |  |  |  |
|  |  |  |  |  |

---

## 🧠 5MJ Yearly Reflection
**🙏 People I am grateful for**
→ <% tp.file.cursor(3) %>

**🌟 Most meaningful achievements**
→ <% tp.file.cursor(4) %>

**📌 Lessons that changed me**
→ <% tp.file.cursor(5) %>

**🔮 Intentions for next year**
→ <% tp.file.cursor(6) %>
```

---

# 🚀 Si quieres, puedo ahora:

### Elige:

1. 🧬 **Optimizar el estilo visual con emojis + colores semánticos**
2. 🔗 **Conectar tu API favorita para frases (ZenQuotes/Quotable/Positive)**
3. 🧩 **Crear dashboards automáticos para Obsidian (Home + KPIs)**
4. 📱 **Adaptar el sistema a Notion/GoodNotes también**

¿Cuál opción quieres? (elige un número) 💚📌
