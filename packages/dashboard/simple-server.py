import http.server
import socketserver
import os
import sys

# --- Configuración ---
# Puerto en el que se ejecutará el servidor.
# Puedes cambiarlo si el puerto 8000 ya está en uso.
PORT = 8000

# Directorio desde el que se servirán los archivos.
# Por defecto, es el directorio actual donde ejecutas el script.
# Si quieres servir desde otro directorio, cambia esta línea:
# DIRECTORY = "/ruta/a/tu/directorio"
DIRECTORY = "./dist" # Directorio actual


# --- Lógica del Servidor ---

# Cambiar al directorio deseado antes de iniciar el servidor
# Esto asegura que el servidor sirva archivos desde la ruta especificada
if not os.path.isdir(DIRECTORY):
    print(f"Error: El directorio '{DIRECTORY}' no existe.")
    sys.exit(1)

os.chdir(DIRECTORY)
print(f"Sirviendo archivos desde el directorio: {os.getcwd()}")


# Configurar el manejador de peticiones. SimpleHTTPRequestHandler es básico y seguro para servir archivos estáticos.
Handler = http.server.SimpleHTTPRequestHandler

# Configurar el servidor. Permite reusar la dirección (evita errores "Address already in use" al reiniciar rápido)
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Servidor web iniciado en http://localhost:{PORT}")
    print(f"Presiona Ctrl+C para detener el servidor.")

    try:
        # Mantener el servidor corriendo indefinidamente hasta que se detenga
        httpd.serve_forever()
    except KeyboardInterrupt:
        # Manejar la interrupción por teclado (Ctrl+C)
        print("\nDeteniendo el servidor web...")
        httpd.shutdown() # Apagar el servidor de forma segura
        print("Servidor web detenido.")
        sys.exit(0)
    except Exception as e:
        print(f"Ocurrió un error: {e}", file=sys.stderr)
        sys.exit(1)

# El bloque 'with' asegura que httpd.server_close() se llame automáticamente al salir.