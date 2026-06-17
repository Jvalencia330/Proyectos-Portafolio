# 🧠 ML_Portfolio — Proyectos de Machine Learning

Colección de proyectos desarrollados durante la asignatura **Aprendizaje de Máquina y Análisis de Datos** en la Pontificia Universidad Javeriana Cali.

Cada notebook es un pipeline completo: exploración de datos, preprocesamiento, entrenamiento y evaluación crítica de resultados.

---

## 📁 Proyectos

### 01 · [Clasificación MNIST con SVM y PCA](./01_MNIST_Classification_SVM.ipynb)

Clasificación de dígitos manuscritos del dataset MNIST usando SVM con reducción dimensional previa mediante PCA.

| | |
|---|---|
| **Técnicas** | PCA · SVM (Lineal, Polinómico, RBF) · StandardScaler |
| **Dataset** | MNIST — dígitos manuscritos |
| **Destacado** | Comparativa de 3 kernels · Visualización 3D del espacio PCA · Análisis de matrices de confusión |

---

### 02 · [Optimización de Clasificación Binaria de Dígitos](./02_Digits_Classification_Optimization.ipynb)

Pipeline enfocado en discriminar las clases 2 y 7 del dataset MNIST, con énfasis en Feature Selection y balanceo de clases.

| | |
|---|---|
| **Técnicas** | EDA · Mutual Information · Feature Selection · SVM · RandomUnderSampler |
| **Dataset** | MNIST — clases 2 y 7 |
| **Destacado** | Reducción de 16 a 4 características · Análisis de separabilidad · Gestión del sesgo bias-variance |

---

### 03 · [Segmentación de Células Sanguíneas con OpenCV](./03_Blood_Cell_Segmentation_OpenCV.ipynb)

Visión por computadora aplicada a biomedicina: segmentación y análisis morfológico de eritrocitos y basófilos en frotis sanguíneos.

| | |
|---|---|
| **Técnicas** | OpenCV · Espacios de color (RGB/HSV/Grises) · Umbralización · Extracción de características |
| **Dataset** | Imágenes de microscopía de células sanguíneas |
| **Destacado** | Pipeline imagen→features→dataset · Aplicación médica real · Automatización sobre lote de imágenes |

---

### 04 · [Seguimiento de Objetos en Tiempo Real (HSV + WebCam)](./04_RealTime_HSV_Object_Tracking.ipynb)

Sistema de visión en tiempo real que segmenta objetos por color en espacio HSV y detecta rostros con clasificadores Haar Cascade, procesando el flujo de la cámara web frame a frame.

| | |
|---|---|
| **Técnicas** | OpenCV · Segmentación HSV · Haar Cascade · Streaming JavaScript en Colab |
| **Dataset** | Video en tiempo real (WebCam) |
| **Destacado** | Procesamiento frame a frame · Robustez ante cambios de iluminación · Integración JS↔Python |

---

### 05 · [Diagnóstico de Cáncer de Mama con ML](./05_Breast_Cancer_Diagnostic_Classification.ipynb)

Modelo predictivo de diagnóstico médico que clasifica tumores como Benignos o Malignos usando características geométricas extraídas de imágenes de biopsia.

| | |
|---|---|
| **Técnicas** | EDA · Perceptrón · ADALINE · Métricas médicas (Recall/Precisión) |
| **Dataset** | Breast Cancer Wisconsin Diagnostic (UCI) |
| **Destacado** | Enfoque en minimizar falsos negativos · Análisis de correlación · Conclusiones con criterio médico |

**Autores:** Jesús Valencia · Rafael Hermida · Isabella Henríquez

---

### 06 · [Pipeline Automático Combinatorial — Wine Dataset](./TrabajoFinal_Pipeline_Robusto_Wine_JAVE.ipynb)

Motor de experimentación masiva que evalúa automáticamente **72 combinaciones únicas** de escaladores, reducciones dimensionales y modelos mediante 5-Fold Cross-Validation.

| | |
|---|---|
| **Técnicas** | Pipeline · PCA · LDA · 9 modelos (SVM, KNN, RF, Naive Bayes...) · 4 escaladores · Cross-Validation |
| **Dataset** | Wine Dataset (UCI) — clasificación multiclase |
| **Destacado** | 72 experimentos automatizados · Benchmark comparativo completo · Análisis LDA vs PCA |

**Autores:** Jesús Valencia · Rafael Hermida · Isabella Henríquez

---

## 🛠️ Stack tecnológico

```
Python · scikit-learn · OpenCV · NumPy · Pandas · Matplotlib · Seaborn
```

## ▶️ Cómo ejecutar

Todos los notebooks están diseñados para **Google Colab**:

1. Abre cualquier notebook en GitHub
2. En la barra de direcciones, cambia `github.com` por `colab.research.google.com/github`
3. Ejecuta todas las celdas con `Ctrl + F9`

> Los notebooks 03 y 04 requieren imágenes o acceso a cámara. Cada notebook incluye instrucciones de carga en sus primeras celdas.

---

## 👤 Autor

**Jesús A. Valencia Sánchez**  
Ingeniería de Sistemas + Administración de Empresas  
Pontificia Universidad Javeriana Cali  
📧 jvalencia@javerianacali.edu.co
