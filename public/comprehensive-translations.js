// Comprehensive Bilingual Translation System - Professional Technical Spanish
// This file contains all translations for the CWS Injury Report System

const comprehensiveTranslations = {
    en: {
        // Header & Navigation
        headerTitle: "Injury Report System",

        // Progress Steps
        step1: "Classification",
        step2: "Employee Info",
        step3: "Incident Details",
        step4: "Injury Details",
        step5: "Photo & Signature",

        // Step 0: Classification
        reportClassificationTitle: "Report Classification",
        classificationInfo: "Please select the type of report you are filing. This helps us ensure the proper documentation and follow-up procedures.",
        incidentTitle: "Incident",
        incidentDesc: "An unexpected event or near miss that could have resulted in injury, but did not cause harm. Examples: slip without fall, near miss, unsafe condition discovered.",
        accidentTitle: "Accident",
        accidentDesc: "An unexpected event that resulted in actual injury, illness, or property damage. Examples: fall with injury, equipment malfunction causing harm, workplace injury.",
        continueBtn: "Continue",

        // Step 1: Employee Info
        employeeInfoTitle: "Employee Information",
        employeeName: "Employee Name",
        employeeNamePH: "Enter full name",
        employeeId: "Employee ID",
        employeeIdPH: "Enter employee ID",
        cellphone: "Cellphone Number",
        cellphonePH: "321-123-4545",
        cellphoneHint: "To be contacted regarding this incident",
        required: "*",

        // Step 2: Incident Details
        incidentDetailsTitle: "Incident Details",
        clientCompany: "Client Company",
        clientCompanyPH: "Enter client company name",
        completeAddress: "Complete Address",
        completeAddressPH: "Enter full street address, city, state, zip code",
        dateTime: "Date & Time",
        dateOfIncident: "Date of Incident",
        timeOfIncident: "Time of Incident",
        description: "Description",
        descriptionLabel: "What Happened?",
        descriptionPH: "Describe what happened in detail...",
        witnessInfo: "Witness Information",
        witnessName: "Witness Name",
        witnessNamePH: "Optional",
        witnessContact: "Witness Contact",
        witnessContactPH: "Phone or email",

        // Step 3: Injury Details
        injuryDetailsTitle: "Injury Details",
        injuryQuestion: "Was there an injury?",
        yesInjury: "Yes, there was an injury",
        noInjury: "No injury occurred",
        injuryType: "Type of Injury",
        selectInjuryType: "Select injury type",
        cut: "Cut/Laceration",
        bruise: "Bruise/Contusion",
        burn: "Burn",
        sprain: "Sprain/Strain",
        fracture: "Fracture",
        amputation: "Amputation",
        foreign: "Foreign Body",
        multiple: "Multiple Injuries",
        other: "Other",
        bodyPart: "Injured Body Part(s)",
        bodyDiagramTitle: "Body Diagram - Select Injured Areas",
        bodyDiagramInstr: "Click on body parts to select injured areas",
        selectedAreas: "Selected Areas",
        noneSelected: "None selected yet",
        viewFront: "Front",
        viewBack: "Back",
        medicalAttention: "Medical Attention Received?",
        noMedical: "No",
        firstAid: "First Aid Only",
        clinic: "Clinic/Urgent Care",
        er: "Emergency Room",
        hospitalized: "Hospitalized",

        // Step 4: Photos & Signature
        photoSignatureTitle: "Photo Evidence & Signature",
        photoSection: "Photo Evidence",
        photoInstr: "Upload Photos (Optional - Maximum 3)",
        uploadBtn: "Upload Photo",
        dragDrop: "or drag and drop",
        fileSize: "PNG, JPG up to 5MB each",
        signatureSection: "Digital Signature",
        signatureRequired: "Reporter's signature is required",
        signInstructions: "Click in the box below to sign",
        clearSignature: "Clear Signature",
        certifyTitle: "Report Certification",
        reporterName: "Reporter Name",
        reporterNamePH: "Your name",
        reporterTitle: "Reporter Position/Title",
        reporterTitlePH: "Your position/title",
        certificationText: "I certify that the information provided in this report is accurate and complete to the best of my knowledge.",

        // Buttons
        nextStep: "Next",
        previousStep: "Previous",
        submitReport: "Submit Report",

        // Success Message
        successTitle: "Report Submitted Successfully!",
        reportId: "Report ID:",
        savedMessage: "Your injury report has been saved locally for demonstration purposes.",
        downloadPdf: "Download PDF",
        submitAnother: "Submit Another Report",
        viewReport: "View Report Data",

        // Loading
        submitting: "Submitting report...",

        // Footer
        footerCompany: "Custom Workforce Solutions LLC",
        footerSystem: "Safety Management System",
        footerCopyright: "© 2025 Custom Workforce Solutions LLC - Engineered by Jufipai"
    },
    es: {
        // Encabezado y Navegación
        headerTitle: "Sistema de Reporte de Lesiones",

        // Pasos de Progreso
        step1: "Clasificación",
        step2: "Info del Empleado",
        step3: "Detalles del Incidente",
        step4: "Detalles de Lesión",
        step5: "Foto y Firma",

        // Paso 0: Clasificación
        reportClassificationTitle: "Clasificación del Reporte",
        classificationInfo: "Por favor seleccione el tipo de reporte que está presentando. Esto nos ayuda a garantizar la documentación y los procedimientos de seguimiento adecuados.",
        incidentTitle: "Incidente",
        incidentDesc: "Un evento inesperado o casi accidente que podría haber resultado en lesión, pero no causó daño. Ejemplos: resbalón sin caída, casi accidente, condición insegura descubierta.",
        accidentTitle: "Accidente",
        accidentDesc: "Un evento inesperado que resultó en lesión real, enfermedad o daño a la propiedad. Ejemplos: caída con lesión, mal funcionamiento de equipo causando daño, lesión laboral.",
        continueBtn: "Continuar",

        // Paso 1: Información del Empleado
        employeeInfoTitle: "Información del Empleado",
        employeeName: "Nombre del Empleado",
        employeeNamePH: "Ingrese nombre completo",
        employeeId: "ID del Empleado",
        employeeIdPH: "Ingrese ID del empleado",
        cellphone: "Número de Celular",
        cellphonePH: "321-123-4545",
        cellphoneHint: "Para ser contactado con respecto a este incidente",
        required: "*",

        // Paso 2: Detalles del Incidente
        incidentDetailsTitle: "Detalles del Incidente",
        clientCompany: "Compañía Cliente",
        clientCompanyPH: "Ingrese nombre de la compañía cliente",
        completeAddress: "Dirección Completa",
        completeAddressPH: "Ingrese dirección completa, ciudad, estado, código postal",
        dateTime: "Fecha y Hora",
        dateOfIncident: "Fecha del Incidente",
        timeOfIncident: "Hora del Incidente",
        description: "Descripción",
        descriptionLabel: "¿Qué Sucedió?",
        descriptionPH: "Describa lo que sucedió en detalle...",
        witnessInfo: "Información del Testigo",
        witnessName: "Nombre del Testigo",
        witnessNamePH: "Opcional",
        witnessContact: "Contacto del Testigo",
        witnessContactPH: "Teléfono o correo electrónico",

        // Paso 3: Detalles de la Lesión
        injuryDetailsTitle: "Detalles de la Lesión",
        injuryQuestion: "¿Hubo una lesión?",
        yesInjury: "Sí, hubo una lesión",
        noInjury: "No ocurrió ninguna lesión",
        injuryType: "Tipo de Lesión",
        selectInjuryType: "Seleccione tipo de lesión",
        cut: "Corte/Laceración",
        bruise: "Moretón/Contusión",
        burn: "Quemadura",
        sprain: "Esguince/Distensión",
        fracture: "Fractura",
        amputation: "Amputación",
        foreign: "Cuerpo Extraño",
        multiple: "Lesiones Múltiples",
        other: "Otro",
        bodyPart: "Parte(s) del Cuerpo Lesionada(s)",
        bodyDiagramTitle: "Diagrama Corporal - Seleccione Áreas Lesionadas",
        bodyDiagramInstr: "Haga clic en las partes del cuerpo para seleccionar áreas lesionadas",
        selectedAreas: "Áreas Seleccionadas",
        noneSelected: "Ninguna seleccionada aún",
        viewFront: "Frente",
        viewBack: "Espalda",
        medicalAttention: "¿Atención Médica Recibida?",
        noMedical: "No",
        firstAid: "Solo Primeros Auxilios",
        clinic: "Clínica/Atención Urgente",
        er: "Sala de Emergencias",
        hospitalized: "Hospitalizado",

        // Paso 4: Fotos y Firma
        photoSignatureTitle: "Evidencia Fotográfica y Firma",
        photoSection: "Evidencia Fotográfica",
        photoInstr: "Subir Fotos (Opcional - Máximo 3)",
        uploadBtn: "Subir Foto",
        dragDrop: "o arrastrar y soltar",
        fileSize: "PNG, JPG hasta 5MB cada uno",
        signatureSection: "Firma Digital",
        signatureRequired: "Se requiere la firma del reportero",
        signInstructions: "Haga clic en el cuadro de abajo para firmar",
        clearSignature: "Borrar Firma",
        certifyTitle: "Certificación del Reporte",
        reporterName: "Nombre del Reportero",
        reporterNamePH: "Su nombre",
        reporterTitle: "Posición/Título del Reportero",
        reporterTitlePH: "Su posición/título",
        certificationText: "Certifico que la información proporcionada en este reporte es precisa y completa según mi mejor conocimiento.",

        // Botones
        nextStep: "Siguiente",
        previousStep: "Anterior",
        submitReport: "Enviar Reporte",

        // Mensaje de Éxito
        successTitle: "¡Reporte Enviado Exitosamente!",
        reportId: "ID del Reporte:",
        savedMessage: "Su reporte de lesión ha sido guardado localmente para fines de demostración.",
        downloadPdf: "Descargar PDF",
        submitAnother: "Enviar Otro Reporte",
        viewReport: "Ver Datos del Reporte",

        // Cargando
        submitting: "Enviando reporte...",

        // Pie de Página
        footerCompany: "Custom Workforce Solutions LLC",
        footerSystem: "Sistema de Gestión de Seguridad",
        footerCopyright: "© 2025 Custom Workforce Solutions LLC - Desarrollado por Jufipai"
    }
};
